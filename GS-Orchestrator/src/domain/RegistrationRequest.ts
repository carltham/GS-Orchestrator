export class RegistrationRequest {
  projectName?: string;
  project?: string;
  path!: string;
  serviceTypes?: Record<string, string>;
  basePorts?: Record<string, number>;
  backendType?: string;
  frontendType?: string;
  databaseType?: string;

  constructor(init?: Partial<RegistrationRequest>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
