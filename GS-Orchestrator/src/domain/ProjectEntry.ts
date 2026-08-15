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

export class ProjectEntry {
  name!: string;
  path!: string;
  registeredAt!: string;
  host?: HostInfo;
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
