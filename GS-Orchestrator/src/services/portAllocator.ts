/**
 * Port Allocator: Assigns dynamic ports to projects
 * Prevents port conflicts across all 14 projects
 */

export class PortAllocator {
  private allocatedPorts: Map<string, number> = new Map();
  private nextPortBase: number = 4200;

  /**
   * Allocate a new port block for a project
   * @param projectName - Name of the project (e.g., "GSShopper")
   * @param serviceType - Type of service (e.g., "backend", "frontend")
   * @returns Allocated port number
   */
  allocatePort(projectName: string, serviceType: string): number {
    const key = `${projectName}:${serviceType}`;

    if (this.allocatedPorts.has(key)) {
      return this.allocatedPorts.get(key)!;
    }

    const port = this.nextPortBase;
    this.allocatedPorts.set(key, port);
    this.nextPortBase++;

    return port;
  }

  /**
   * Get allocated port for a project service
   * @param projectName - Name of the project
   * @param serviceType - Type of service
   * @returns Port number or undefined if not allocated
   */
  getPort(projectName: string, serviceType: string): number | undefined {
    return this.allocatedPorts.get(`${projectName}:${serviceType}`);
  }

  /**
   * Get all allocated ports for a project
   * @param projectName - Name of the project
   * @returns Object with service -> port mappings
   */
  getProjectPorts(projectName: string): Record<string, number> {
    const ports: Record<string, number> = {};

    this.allocatedPorts.forEach((port, key) => {
      const [project, service] = key.split(':');
      if (project === projectName) {
        ports[service] = port;
      }
    });

    return ports;
  }

  /**
   * Get current state (for persistence)
   */
  getState() {
    return {
      allocatedPorts: Object.fromEntries(this.allocatedPorts),
      nextPortBase: this.nextPortBase,
    };
  }

  /**
   * Restore state (from persistence)
   */
  restoreState(state: { allocatedPorts: Record<string, number>; nextPortBase: number }) {
    this.allocatedPorts = new Map(Object.entries(state.allocatedPorts));
    this.nextPortBase = state.nextPortBase;
  }
}
