/**
 * Port Allocator: Assigns dynamic ports to projects based on server/service type
 * Prevents port conflicts across projects
 */

import { RegistryService } from './RegistryService';
import { ServerScannerService } from './ServerScannerService';

// Default port range bases by server/service type
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

export class PortAllocatorService {
  private registry: RegistryService;
  private scanner?: ServerScannerService;

  constructor(registry: RegistryService, scanner?: ServerScannerService) {
    this.registry = registry;
    this.scanner = scanner;
  }

  /**
   * Allocate a port for a project service based on requested server/service type and optional requested custom base port
   */
  allocatePort(
    projectName: string,
    serviceKey: string,
    serverType?: string,
    customBasePort?: number
  ): number {
    const registryState = this.registry.getState();
    const existingProject = registryState.projects[projectName];

    if (existingProject && existingProject.components) {
      for (const [key, info] of Object.entries(existingProject.components)) {
        if (key.startsWith(`${serviceKey}::`) || key === serviceKey) {
          return info.port;
        }
      }
    }

    const typeKey = (serverType || serviceKey).toLowerCase();
    const basePort = customBasePort || SERVICE_TYPE_BASE_PORTS[typeKey] || 3000;

    // Collect ports allocated to OTHER projects
    const usedPortsByOtherProjects = new Set<number>();
    for (const [otherName, proj] of Object.entries(registryState.projects)) {
      if (otherName === projectName) continue;
      if (proj.components) {
        for (const info of Object.values(proj.components)) {
          usedPortsByOtherProjects.add(info.port);
        }
      }
    }

    // Collect ports occupied by UNREGISTERED external services
    const externalOccupiedPorts = new Set<number>();
    if (this.scanner) {
      const unregistered = this.scanner.loadData();
      for (const s of unregistered.servers) {
        // If process belongs to the client project itself, don't consider it external conflict
        if (s.projectPath && existingProject?.path) {
          const resolvedServerPath = require('path').resolve(s.projectPath);
          const resolvedProjPath = require('path').resolve(existingProject.path);
          if (resolvedServerPath === resolvedProjPath || resolvedServerPath.startsWith(resolvedProjPath + require('path').sep)) {
            continue;
          }
        }
        externalOccupiedPorts.add(s.port);
      }
    }

    let candidatePort = basePort;
    while (usedPortsByOtherProjects.has(candidatePort) || externalOccupiedPorts.has(candidatePort)) {
      candidatePort++;
    }

    return candidatePort;
  }
}
