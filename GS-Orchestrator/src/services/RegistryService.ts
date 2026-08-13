/**
 * Registry: Manages persistent storage of project data
 * Stores to registry.json in project root
 */

import * as fs from 'fs';
import * as path from 'path';
import { ProjectEntry, SubSystemInfo } from '../domain/ProjectEntry';
import { RegistryData } from '../domain/RegistryData';

export class RegistryService {
  private registryPath: string;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
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
      console.error('Error reading/ensuring registry:', error);
      return defaultData;
    }
  }

  /**
   * Always load fresh data directly from disk and clean up stale stopping projects
   */
  private load(): RegistryData {
    const data = this.ensureFileExists();
    let updated = false;

    for (const [name, proj] of Object.entries(data.projects)) {
      if (proj.status === 'stopping') {
        const lastUpdatedMs = new Date(proj.registeredAt || data.lastUpdated).getTime();
        const twoMinutesMs = 2 * 60 * 1000;
        if (Date.now() - lastUpdatedMs > twoMinutesMs) {
          console.log(`🧹 Cleaning up stale stopping project entry "${name}"`);
          delete data.projects[name];
          updated = true;
        }
      }
    }

    if (updated) {
      this.save(data);
    }

    return data;
  }

  /**
   * Save updated data directly to disk
   */
  private save(data: RegistryData): void {
    try {
      data.lastUpdated = new Date().toISOString();
      const dir = path.dirname(this.registryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving registry:', error);
    }
  }

  /**
   * Register a new project directly to disk with components mapping
   */
  registerProject(
    name: string,
    projectPath: string,
    components: Record<string, SubSystemInfo>,
    ticket?: string
  ): ProjectEntry {
    const data = this.load();

    const entry: ProjectEntry = {
      name,
      path: projectPath,
      registeredAt: new Date().toISOString(),
      components,
      status: 'running',
      ticket,
    };

    data.projects[name] = entry;
    this.save(data);

    return entry;
  }

  /**
   * Get project entry directly from disk
   */
  getProject(name: string): ProjectEntry | undefined {
    const data = this.load();
    return data.projects[name];
  }

  /**
   * Update project path directly on disk
   */
  updateProjectPath(name: string, projectPath: string): void {
    const data = this.load();
    if (data.projects[name]) {
      data.projects[name].path = projectPath;
      this.save(data);
    }
  }

  /**
   * Update entire project entry directly on disk
   */
  updateProject(name: string, project: ProjectEntry): void {
    const data = this.load();
    if (data.projects[name]) {
      data.projects[name] = project;
      this.save(data);
    }
  }

  /**
   * Update next port base directly on disk
   */
  updateNextPortBase(nextBase: number): void {
    const data = this.load();
    data.nextPortBase = nextBase;
    this.save(data);
  }

  /**
   * Get total count of registered projects directly from disk
   */
  getProjectCount(): number {
    const data = this.load();
    return Object.keys(data.projects).length;
  }

  /**
   * Get fresh registry state directly from disk
   */
  getState(): RegistryData {
    return this.load();
  }

  /**
   * Unregister a project from the registry
   */
  unregisterProject(name: string): boolean {
    const data = this.load();
    if (data.projects[name]) {
      delete data.projects[name];
      this.save(data);
      return true;
    }
    return false;
  }
}
