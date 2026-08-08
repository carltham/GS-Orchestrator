export class ProjectEntry {
  name!: string;
  path!: string;
  registeredAt!: string;
  components!: Record<string, number>;
  status!: 'running' | 'stopped';
  pid?: number;
  ticket?: string;

  constructor(init?: Partial<ProjectEntry>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
