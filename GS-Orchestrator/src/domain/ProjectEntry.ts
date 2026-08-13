export interface SubSystemInfo {
  port: number;
  status: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped' | string;
  pid?: number | null;
  error?: string;
}

export class ProjectEntry {
  name!: string;
  path!: string;
  registeredAt!: string;
  components!: Record<string, SubSystemInfo>;
  status!: 'start' | 'starting' | 'running' | 'partially' | 'stop' | 'stopping' | 'stopped';
  pid?: number;
  ticket?: string;

  constructor(init?: Partial<ProjectEntry>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
