import { ProjectEntry } from './ProjectEntry';

export class RegistryData {
  projects: Record<string, ProjectEntry> = {};
  nextPortBase: number = 4200;
  lastUpdated: string = new Date().toISOString();

  constructor(init?: Partial<RegistryData>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
