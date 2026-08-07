/**
 * Port Allocator: Assigns dynamic ports to projects
 * Prevents port conflicts across all 14 projects
 */

import { Registry } from './registry';

export class PortAllocator {
  private registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  /**
   * Allocate a new port block for a project by reading current disk state
   */
  allocatePort(projectName: string, serviceType: string): number {
    const registryState = this.registry.getState();
    const existingProject = registryState.projects[projectName];

    if (existingProject && existingProject.ports && existingProject.ports[serviceType]) {
      return existingProject.ports[serviceType];
    }

    const port = registryState.nextPortBase;
    this.registry.updateNextPortBase(port + 1);

    return port;
  }
}
