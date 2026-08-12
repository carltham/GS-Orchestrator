import * as fs from 'fs';
import * as path from 'path';
import { UnregisteredServer, UnregisteredServersData } from '../domain/ServerScannerTypes';
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
   * Check if a list of ports are in use via remote Process Server check-ports endpoint
   */
  public async checkPortsOccupied(ports: number[]): Promise<Record<number, boolean>> {
    try {
      const res = await fetch('http://localhost:9999/ps/host/check-ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports })
      });
      if (res.ok) {
        const body = await res.json() as any;
        return body.ports || {};
      }
    } catch (err) {
      console.warn(`⚠️ Could not reach Process Server check-ports: ${(err as Error).message}`);
    }

    // Fallback: Default to unoccupied if Process Server is down (avoids locking registry)
    const fallback: Record<number, boolean> = {};
    for (const port of ports) {
      fallback[port] = false;
    }
    return fallback;
  }

  /**
   * Scan common port ranges for running servers
   */
  public async scanRunningServers(): Promise<UnregisteredServer[]> {
    const registryData = this.registry.getState();

    // 1. Gather all registered query ports to verify active status
    const allRegisteredPorts: number[] = [];
    const registeredProjectNames: string[] = [];

    for (const [projName, proj] of Object.entries(registryData.projects)) {
      if (!proj.components || Object.keys(proj.components).length === 0) continue;
      registeredProjectNames.push(projName);
      for (const port of Object.values(proj.components)) {
        allRegisteredPorts.push(port);
      }
    }

    // Single remote batch HTTP check instead of launching native processes or consecutive TCP sockets
    const portsOccupiedMap = await this.checkPortsOccupied(allRegisteredPorts);

    // Update statuses for all projects
    for (const projName of registeredProjectNames) {
      const proj = registryData.projects[projName];
      let occupiedCount = 0;
      const totalPorts = Object.keys(proj.components).length;

      for (const port of Object.values(proj.components)) {
        if (portsOccupiedMap[port]) {
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

    // 2. Query Process Server host scanner with excluded registered ports/directories
    const registeredPortsArray: number[] = [];
    const registeredProjectPaths: string[] = [];
    const refreshedRegistry = this.registry.getState();

    for (const proj of Object.values(refreshedRegistry.projects)) {
      if (proj.path) {
        registeredProjectPaths.push(proj.path);
      }
      if (proj.components) {
        for (const port of Object.values(proj.components)) {
          registeredPortsArray.push(port);
        }
      }
    }

    let detectedServers: UnregisteredServer[] = [];
    try {
      const portsParam = encodeURIComponent(registeredPortsArray.join(','));
      const pathsParam = encodeURIComponent(registeredProjectPaths.join(','));
      const res = await fetch(`http://localhost:9999/ps/host/unregistered?registeredPorts=${portsParam}&registeredPaths=${pathsParam}`);
      if (res.ok) {
        const body = await res.json() as any;
        detectedServers = body.servers || [];
      }
    } catch (err) {
      console.warn(`⚠️ Could not reach Process Server host scanner: ${(err as Error).message}`);
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
