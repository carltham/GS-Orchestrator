import * as net from 'net';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ProcessDetails, UnregisteredServer, UnregisteredServersData } from '../domain/ServerScannerTypes';
import { RegistryService } from './RegistryService';

export class ServerScannerService {
  private filePath: string;
  private registry: RegistryService;
  private intervalTimer?: NodeJS.Timeout;

  constructor(filePath: string, registry: RegistryService) {
    this.filePath = filePath;
    this.registry = registry;
    this.ensureFileExists();
  }

  /**
   * Start periodic background scan every 30 seconds
   */
  public startPeriodicScan(intervalMs: number = 30000): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      this.scanRunningServers().catch((err) => {
        console.error('Error during periodic server scan:', err);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic background scan
   */
  public stopPeriodicScan(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
  }

  /**
   * Ensure file and parent directory exist on disk
   */
  private ensureFileExists(): UnregisteredServersData {
    const defaultData: UnregisteredServersData = {
      lastScanned: new Date().toISOString(),
      servers: [],
    };

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(defaultData, null, 2));
        return defaultData;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return defaultData;
    }
  }

  /**
   * Check if a specific port is in use via TCP connection attempt
   */
  public async isPortOccupied(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(200);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, '127.0.0.1');
    });
  }

  /**
   * Probe port via HTTP to try to detect service type
   */
  private async probeHttpType(port: number): Promise<string> {
    if (port === 5432 || port === 5433) {
      return 'database::postgres';
    }

    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/`, { timeout: 500 }, (res) => {
        const headerRaw = res.headers['server'];
        const serverHeader = Array.isArray(headerRaw) ? headerRaw.join(' ') : headerRaw || '';
        if (serverHeader.toLowerCase().includes('vite')) return resolve('vite');
        if (serverHeader.toLowerCase().includes('express')) return resolve('express');
        resolve('http-service');
      });
      req.on('error', () => resolve('tcp-service'));
      req.on('timeout', () => {
        req.destroy();
        resolve('tcp-service');
      });
    });
  }

  /**
   * Probe process details (PID, working directory, project name, command) for a listening port
   */
  private inspectProcessOnPort(port: number): ProcessDetails {
    const details: ProcessDetails = {};

    try {
      // Find listening PID on Linux using lsof
      const lsofOut = execSync(`lsof -i :${port} -sTCP:LISTEN -t`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();

      const pids = lsofOut.split('\n').map((p) => parseInt(p.trim(), 10)).filter((p) => !isNaN(p));
      if (pids.length > 0) {
        const pid = pids[0];
        details.pid = pid;

        // Resolve working directory from /proc/<pid>/cwd or pwdx
        try {
          if (fs.existsSync(`/proc/${pid}/cwd`)) {
            const cwdPath = fs.readlinkSync(`/proc/${pid}/cwd`);
            details.projectPath = cwdPath;
            details.projectName = path.basename(cwdPath);
          } else {
            const pwdxOut = execSync(`pwdx ${pid}`, {
              encoding: 'utf-8',
              stdio: ['ignore', 'pipe', 'ignore'],
            }).trim();
            const cwd = pwdxOut.split(': ')[1]?.trim();
            if (cwd) {
              details.projectPath = cwd;
              details.projectName = path.basename(cwd);
            }
          }
        } catch (e) {
          // ignore directory resolution errors
        }

        // Resolve command line from /proc/<pid>/cmdline
        try {
          if (fs.existsSync(`/proc/${pid}/cmdline`)) {
            const cmdContent = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf-8');
            details.cmd = cmdContent.split('\0').join(' ').trim();
          }
        } catch (e) {
          // ignore cmdline read error
        }
        // Fallback for system/daemon processes (e.g., PostgreSQL on 5432 or root processes)
        if (!details.projectName) {
          if (port === 5432 || port === 5433) {
            details.projectName = 'PostgreSQL System Service';
            details.cmd = 'System Daemon / Docker Proxy (PostgreSQL)';
          } else {
            details.projectName = 'System/External Daemon';
            details.cmd = `Unmanaged System Service (Port ${port})`;
          }
        }
      } else {
        // Known port fallbacks when lsof returns no user PIDs
        if (port === 5432 || port === 5433) {
          details.projectName = 'PostgreSQL System Service';
          details.cmd = 'System Daemon / Docker Proxy (PostgreSQL)';
        } else {
          details.projectName = 'System/External Daemon';
          details.cmd = `Unmanaged System Service (Port ${port})`;
        }
      }
    } catch (err) {
      if (port === 5432 || port === 5433) {
        details.projectName = 'PostgreSQL System Service';
        details.cmd = 'System Daemon / Docker Proxy (PostgreSQL)';
      } else {
        details.projectName = 'System/External Daemon';
        details.cmd = `Unmanaged System Service (Port ${port})`;
      }
    }

    return details;
  }

  /**
   * Scan common port ranges for running servers
   */
  public async scanRunningServers(): Promise<UnregisteredServer[]> {
    const portRanges: [number, number][] = [
      [3000, 3020],
      [4200, 4210],
      [5173, 5180],
      [5432, 5435],
      [8080, 8090],
      [9000, 9010],
      [9323, 9323],
    ];

    const registryData = this.registry.getState();

    // 1. Verify active port status for all registered projects
    for (const [projName, proj] of Object.entries(registryData.projects)) {
      if (!proj.components || Object.keys(proj.components).length === 0) continue;

      let occupiedCount = 0;
      const totalPorts = Object.keys(proj.components).length;

      for (const port of Object.values(proj.components)) {
        const active = await this.isPortOccupied(port);
        if (active) {
          occupiedCount++;
        }
      }

      let newStatus: 'running' | 'partially' | 'stopped' = 'stopped';
      if (occupiedCount === totalPorts) {
        newStatus = 'running';
      } else if (occupiedCount > 0) {
        newStatus = 'partially';
      }

      // Update status if it changed or if project was stuck in a stopping state while ports are active
      if (proj.status !== newStatus || (proj.status as string) === 'stopping') {
        proj.status = newStatus;
        this.registry.updateProject(projName, proj);
      }
    }

    const registeredPorts = new Set<number>();
    const refreshedRegistry = this.registry.getState();
    for (const proj of Object.values(refreshedRegistry.projects)) {
      if (proj.components) {
        for (const port of Object.values(proj.components)) {
          registeredPorts.add(port);
        }
      }
    }

    const detectedServers: UnregisteredServer[] = [];

    for (const [startPort, endPort] of portRanges) {
      for (let p = startPort; p <= endPort; p++) {
        // Skip orchestrator port 9000 and registered ports
        if (p === 9000 || registeredPorts.has(p)) {
          continue;
        }

        const occupied = await this.isPortOccupied(p);
        if (occupied) {
          const type = await this.probeHttpType(p);
          const processInfo = this.inspectProcessOnPort(p);

          detectedServers.push({
            port: p,
            pid: processInfo.pid,
            projectName: processInfo.projectName,
            projectPath: processInfo.projectPath,
            cmd: processInfo.cmd,
            type,
            detectedAt: new Date().toISOString(),
          });
        }
      }
    }

    this.saveData(detectedServers);
    return detectedServers;
  }

  /**
   * Read current unregistered servers from disk
   */
  public loadData(): UnregisteredServersData {
    return this.ensureFileExists();
  }

  /**
   * Save detected unregistered servers to disk
   */
  private saveData(servers: UnregisteredServer[]): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data: UnregisteredServersData = {
        lastScanned: new Date().toISOString(),
        servers,
      };
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error saving unregistered servers file:', err);
    }
  }
}
