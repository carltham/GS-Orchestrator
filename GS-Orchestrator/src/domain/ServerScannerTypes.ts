export class ProcessDetails {
  pid?: number;
  projectPath?: string;
  projectName?: string;
  cmd?: string;

  constructor(init?: Partial<ProcessDetails>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class UnregisteredServer {
  port!: number;
  pid?: number;
  projectName?: string;
  projectPath?: string;
  cmd?: string;
  type?: string;
  detectedAt!: string;

  constructor(init?: Partial<UnregisteredServer>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class UnregisteredServersData {
  lastScanned: string = new Date().toISOString();
  servers: UnregisteredServer[] = [];

  constructor(init?: Partial<UnregisteredServersData>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
