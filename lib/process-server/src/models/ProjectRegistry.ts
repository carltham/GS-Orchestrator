/**
 * ProjectRegistry Model: Manages persistent storage of project data (registry.json)
 * and handles dynamic port allocations for services.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { SystemConfigService } from '../services/SystemConfigService';

export interface SubSystemInfo {
  port: number;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped' | string;
  pid?: number | null;
  error?: string;
}

export interface HostInfo {
  hostname: string;
  domain?: string;
  platform: string;
  ipAddresses: string[];
}

export interface ProjectEntry {
  name: string;
  path: string;
  registeredAt: string;
  clientInstanceId?: string;
  host?: HostInfo;
  components: Record<string, SubSystemInfo>;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped';
  pid?: number | null;
  ticket?: string;
  unstoppable?: boolean;
}

export interface RegistryData {
  projects: Record<string, ProjectEntry>;
  nextPortBase: number;
  lastUpdated: string;
}

const SERVICE_TYPE_BASE_PORTS: Record<string, number> = {
  'node-ts': 3000,
  'backend': 8080,
  'frontend': 9001,
  'angular': 9001,
  'react': 5173,
  'vite': 5173,
  'database': 5433,
  'postgres': 5433,
};

export class ProjectRegistry {
  private registryPath: string;

  constructor(registryPath?: string) {
    this.registryPath = registryPath || path.resolve(process.cwd(), '..', '..', 'db', 'registry.json');
    
    // Fallback if running directly inside lib/process-server without root-level launch
    if (!fs.existsSync(path.dirname(this.registryPath))) {
      this.registryPath = path.resolve(process.cwd(), 'db', 'registry.json');
    }
    
    this.ensureFileExists();
  }

  /**
   * Ensure registry file and parent folder exist on disk
   */
  private ensureFileExists(): RegistryData {
    const defaultData: RegistryData = {
      projects: {},
      nextPortBase: 4200,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.registryPath)) {
        fs.writeFileSync(this.registryPath, JSON.stringify(defaultData, null, 2));
        return defaultData;
      }

      const content = fs.readFileSync(this.registryPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[ProjectRegistry] Error reading/ensuring registry:', error);
      return defaultData;
    }
  }

  /**
   * Load fresh registry data from disk
   */
  public load(): RegistryData {
    return this.ensureFileExists();
  }

  /**
   * Save updated registry data to disk
   */
  public save(data: RegistryData): void {
    try {
      data.lastUpdated = new Date().toISOString();
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[ProjectRegistry] Error saving registry:', error);
    }
  }

  /**
   * Register or update a project and allocate component ports dynamically
   */
  public registerProject(
    name: string,
    projectPath: string,
    serviceTypes: Record<string, string>,
    ticket?: string,
    host?: HostInfo,
    occupiedPorts?: number[],
    preferredPorts?: Record<string, number>,
    clientInstanceId?: string
  ): ProjectEntry {
    const data = this.load();
    const existing = data.projects[name];

    const componentsPorts: Record<string, SubSystemInfo> = existing?.components || {};
    const excludedPorts = new Set<number>(occupiedPorts || []);

    // Allocate ports for new components using the service mapping
    for (const [componentKey, serviceType] of Object.entries(serviceTypes)) {
      const serviceName = componentKey.split('::')[0] || componentKey;
      
      let matchedCompKey: string | null = null;
      for (const existingCompKey of Object.keys(componentsPorts)) {
        if (existingCompKey.startsWith(`${serviceName}::`) || existingCompKey === serviceName) {
          matchedCompKey = existingCompKey;
          break;
        }
      }

      // If already allocated, check if the previously assigned port is currently conflicting with a client-reported active port (e.g. host service/docker)
      if (matchedCompKey) {
        const currentPort = componentsPorts[matchedCompKey].port;
        const preferredPort = preferredPorts?.[serviceName];
        if (this.canUsePreferredPort(name, preferredPort, data, excludedPorts)) {
          componentsPorts[matchedCompKey].port = preferredPort;
        } else if (name !== 'GS-Orchestrator' && name !== 'gs-orchestrator' && (!Number.isFinite(currentPort) || excludedPorts.has(currentPort) || this.isPortActive(currentPort))) {
          // Re-allocate avoiding excluded ports
          const allocatedPort = this.allocatePort(name, serviceName, serviceType, data, excludedPorts);
          componentsPorts[matchedCompKey].port = allocatedPort;
        } else if (name === 'GS-Orchestrator' || name === 'gs-orchestrator') {
          componentsPorts[matchedCompKey].port = 10000;
        }
      } else {
        const preferredPort = preferredPorts?.[serviceName];
        const allocatedPort = this.canUsePreferredPort(name, preferredPort, data, excludedPorts)
          ? preferredPort
          : this.allocatePort(name, serviceName, serviceType, data, excludedPorts);
        const compKeyWithService = `${serviceName}::${serviceType}`;
        componentsPorts[compKeyWithService] = {
          port: allocatedPort,
          status: 'running',
          pid: null
        };
      }
    }

    const isProtected = SystemConfigService.getInstance().isProtectedService(name);

    const entry: ProjectEntry = {
      name,
      path: projectPath,
      registeredAt: new Date().toISOString(),
      clientInstanceId: clientInstanceId || existing?.clientInstanceId,
      host: host || existing?.host,
      components: componentsPorts,
      status: 'running',
      ticket,
      unstoppable: isProtected
    };

    data.projects[name] = entry;
    this.save(data);

    return entry;
  }

  /**
   * Port Allocator logic inside the Model layer
   */
  private allocatePort(
    projectName: string,
    serviceName: string,
    serviceType: string,
    data: RegistryData,
    excludedPorts: Set<number> = new Set()
  ): number {
    // Fixed port allocation for Orchestrator itself
    if (projectName === 'GS-Orchestrator' || projectName === 'gs-orchestrator') {
      return 10000;
    }

    const typeKey = (serviceType || serviceName).toLowerCase();
    const basePort = SERVICE_TYPE_BASE_PORTS[typeKey] || 3000;

    // Collect all ports allocated to other projects
    const usedPorts = new Set<number>(excludedPorts);
    for (const [otherName, proj] of Object.entries(data.projects)) {
      if (otherName === projectName) continue;
      if (proj.components) {
        for (const info of Object.values(proj.components)) {
          usedPorts.add(info.port);
        }
      }
    }

    let candidatePort = basePort;
    // Walk upward to avoid collision with other registered projects or actively bound local sockets
    while (usedPorts.has(candidatePort) || this.isPortActive(candidatePort)) {
      candidatePort++;
    }

    return candidatePort;
  }

  private canUsePreferredPort(
    projectName: string,
    preferredPort: number | undefined,
    data: RegistryData,
    excludedPorts: Set<number>
  ): preferredPort is number {
    if (!Number.isInteger(preferredPort) || preferredPort! <= 0 || preferredPort! > 65535) return false;
    if (excludedPorts.has(preferredPort!)) return false;
    return !Object.entries(data.projects).some(([otherName, project]) =>
      otherName !== projectName
      && Object.values(project.components || {}).some((component) => component.port === preferredPort)
    );
  }

  private isPortActive(port: number): boolean {
    const cp = require('child_process');
    try {
      // Fast probe via ss or fuser if on linux, else socket probe
      const output = cp.execSync(`ss -tlnH sport = :${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
      return output.length > 0;
    } catch {
      return false;
    }
  }

  public getProject(name: string): ProjectEntry | undefined {
    const data = this.load();
    const project = data.projects[name];
    if (project) {
      project.unstoppable = SystemConfigService.getInstance().isProtectedService(name);
    }
    return project;
  }

  public getProjects(): Record<string, ProjectEntry> {
    const data = this.load();
    const sysConfig = SystemConfigService.getInstance();
    for (const [name, project] of Object.entries(data.projects)) {
      project.unstoppable = sysConfig.isProtectedService(name);
    }
    return data.projects;
  }

  public updateProject(name: string, project: ProjectEntry): void {
    const data = this.load();
    if (data.projects[name]) {
      data.projects[name] = project;
      this.save(data);
    }
  }

  public unregisterProject(name: string): boolean {
    const data = this.load();
    if (data.projects[name]) {
      delete data.projects[name];
      this.save(data);
      return true;
    }
    return false;
  }
}

export const projectRegistry = new ProjectRegistry();
