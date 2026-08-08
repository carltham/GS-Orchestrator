export interface OrchestratorResponse {
  backend: number;
  frontend: number;
  database: number;
  ticket?: string;
  timestamp?: string;
}

export interface PrestartConfig {
  backend: number;
  frontend: number;
  database: number;
  ticket?: string;
  timestamp: string;
  project: string;
}

export interface ApplicationHealth {
  status: 'ok' | 'degraded' | 'down';
  backendStatus: boolean;
  frontendStatus: boolean;
  uptimeSeconds: number;
  ticket?: string;
}

export interface ServiceTypesConfig {
  backend?: string;
  frontend?: string;
  database?: string;
}

export interface BasePortsConfig {
  backend?: number;
  frontend?: number;
  database?: number;
}

export interface RegistrationOptions {
  serviceTypes?: ServiceTypesConfig;
  basePorts?: BasePortsConfig;
}
