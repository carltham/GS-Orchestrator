export class ProjectEntry {
  name!: string;
  path!: string;
  registeredAt!: string;
  components!: Record<string, number>;
  status!: 'start' | 'starting' | 'running' | 'stop' | 'stopping' | 'stopped';
  pid?: number;
  ticket?: string;

  constructor(init?: Partial<ProjectEntry>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
