/**
 * Registry: Manages persistent storage of project data
 * Stores to registry.json in project root
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectEntry {
  name: string;
  path: string;
  registeredAt: string;
  ports: Record<string, number>;
  status: 'running' | 'stopped';
  pid?: number;
}

export interface RegistryData {
  projects: Record<string, ProjectEntry>;
  nextPortBase: number;
  lastUpdated: string;
}

export class Registry {
  private registryPath: string;
  private data: RegistryData;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
    this.data = this.load();
  }

  /**
   * Load registry from disk
   */
  private load(): RegistryData {
    try {
      if (fs.existsSync(this.registryPath)) {
        const content = fs.readFileSync(this.registryPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading registry:', error);
    }

    return {
      projects: {},
      nextPortBase: 4200,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Save registry to disk
   */
  private save(): void {
    try {
      this.data.lastUpdated = new Date().toISOString();
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving registry:', error);
    }
  }

  /**
   * Register a new project
   */
  registerProject(name: string, projectPath: string, ports: Record<string, number>): ProjectEntry {
    const entry: ProjectEntry = {
      name,
      path: projectPath,
      registeredAt: new Date().toISOString(),
      ports,
      status: 'running',
    };

    this.data.projects[name] = entry;
    this.save();

    return entry;
  }

  /**
   * Get project entry
   */
  getProject(name: string): ProjectEntry | undefined {
    return this.data.projects[name];
  }

  /**
   * Get all projects
   */
  getAllProjects(): Record<string, ProjectEntry> {
    return this.data.projects;
  }

  /**
   * Update project status
   */
  updateProjectStatus(name: string, status: 'running' | 'stopped', pid?: number): void {
    if (this.data.projects[name]) {
      this.data.projects[name].status = status;
      if (pid !== undefined) {
        this.data.projects[name].pid = pid;
      }
      this.save();
    }
  }

  /**
   * Update next port base
   */
  updateNextPortBase(nextBase: number): void {
    this.data.nextPortBase = nextBase;
    this.save();
  }

  /**
   * Get registry state
   */
  getState(): RegistryData {
    return this.data;
  }
}
