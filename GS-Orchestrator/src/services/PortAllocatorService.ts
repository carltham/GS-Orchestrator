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
      for (const [key, p] of Object.entries(existingProject.components)) {
        if (key.startsWith(`${serviceKey}::`) || key === serviceKey) {
          return p;
        }
      }
    }

    const typeKey = (serverType || serviceKey).toLowerCase();
    const basePort = customBasePort || SERVICE_TYPE_BASE_PORTS[typeKey] || 3000;

    // Collect all currently allocated ports across all projects to prevent conflicts
    const usedPorts = new Set<number>();
    for (const proj of Object.values(registryState.projects)) {
      if (proj.components) {
        for (const p of Object.values(proj.components)) {
          usedPorts.add(p);
        }
      }
    }

    // Include ports from unregistered servers
    if (this.scanner) {
      const unregistered = this.scanner.loadData();
      for (const s of unregistered.servers) {
        usedPorts.add(s.port);
      }
    }

    let candidatePort = basePort;
    while (usedPorts.has(candidatePort)) {
      candidatePort++;
    }

    return candidatePort;
  }
}
