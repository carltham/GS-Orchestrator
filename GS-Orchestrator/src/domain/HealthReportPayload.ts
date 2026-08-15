import { HostInfo } from './ProjectEntry';

export class HealthStatus {
  status!: 'ok' | 'degraded' | 'down';
  backendStatus!: boolean;
  frontendStatus!: boolean;
  uptimeSeconds!: number;
  ticket?: string;

  constructor(init?: Partial<HealthStatus>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}

export class HealthReportPayload {
  projectName!: string;
  health?: HealthStatus;
  host?: HostInfo;
  timestamp?: string;

  constructor(init?: Partial<HealthReportPayload>) {
    if (init) {
      Object.assign(this, init);
    }
  }
}
