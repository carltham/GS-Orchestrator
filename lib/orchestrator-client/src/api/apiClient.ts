import http from 'http';
import { detectProjectName } from '../config';
import { detectComponentsAndFrameworks } from '../discovery/detector';
import {
  ApplicationHealth,
  BasePortsConfig,
  OrchestratorResponse,
  RegistrationOptions,
  ServiceTypesConfig,
} from '../types';

const ORCHESTRATOR_HOST = process.env.ORCHESTRATOR_HOST || 'localhost';
const ORCHESTRATOR_PORT = parseInt(process.env.ORCHESTRATOR_PORT || '9000', 10);

export function getOrchestratorHost(): string {
  return ORCHESTRATOR_HOST;
}

export function getOrchestratorPort(): number {
  return ORCHESTRATOR_PORT;
}

export async function isOrchestratorAvailable(targetUrl?: string): Promise<boolean> {
  return new Promise((resolve) => {
    let hostname = ORCHESTRATOR_HOST;
    let port = ORCHESTRATOR_PORT;

    if (targetUrl) {
      try {
        const urlObj = new URL(targetUrl);
        hostname = urlObj.hostname;
        port = parseInt(urlObj.port || '80', 10);
      } catch (err) {
        // use defaults
      }
    }

    const options = {
      hostname,
      port,
      path: '/api/health',
      method: 'GET',
      timeout: 2000,
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 204);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

export async function registerWithOrchestrator(
  options?: ServiceTypesConfig | RegistrationOptions
): Promise<OrchestratorResponse> {
  const projectName = detectProjectName();

  let serviceTypesParam: ServiceTypesConfig | undefined;
  let basePortsParam: BasePortsConfig | undefined;

  if (options) {
    if ('serviceTypes' in options || 'basePorts' in options) {
      const regOpts = options as RegistrationOptions;
      serviceTypesParam = regOpts.serviceTypes;
      basePortsParam = regOpts.basePorts;
    } else {
      serviceTypesParam = options as ServiceTypesConfig;
    }
  }

  const autoDetected = serviceTypesParam ? {} : detectComponentsAndFrameworks(process.cwd());

  const targetServiceTypes: ServiceTypesConfig = {
    ...autoDetected,
    ...serviceTypesParam,
  };

  if (!targetServiceTypes.backend && process.env.BACKEND_SERVICE_TYPE) {
    targetServiceTypes.backend = process.env.BACKEND_SERVICE_TYPE;
  }
  if (!targetServiceTypes.frontend && process.env.FRONTEND_SERVICE_TYPE) {
    targetServiceTypes.frontend = process.env.FRONTEND_SERVICE_TYPE;
  }
  if (!targetServiceTypes.database && process.env.DATABASE_SERVICE_TYPE) {
    targetServiceTypes.database = process.env.DATABASE_SERVICE_TYPE;
  }

  if (Object.keys(targetServiceTypes).length === 0) {
    targetServiceTypes.backend = 'node-ts';
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      projectName,
      path: process.cwd(),
      serviceTypes: targetServiceTypes,
      basePorts: basePortsParam,
    });

    const reqOptions = {
      hostname: ORCHESTRATOR_HOST,
      port: ORCHESTRATOR_PORT,
      path: '/api/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200 || res.statusCode === 201) {
            const response = JSON.parse(data);
            resolve(response.ports || response);
          } else {
            reject(new Error(`Orchestrator returned ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Orchestrator response: ${error}`));
        }
      });
    });

    req.on('error', (error) => reject(error));
    req.write(postData);
    req.end();
  });
}

export async function sendHealthReport(health: ApplicationHealth, targetUrl?: string): Promise<boolean> {
  const projectName = detectProjectName();

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      projectName,
      health,
      timestamp: new Date().toISOString(),
    });

    let hostname = ORCHESTRATOR_HOST;
    let port = ORCHESTRATOR_PORT;

    if (targetUrl) {
      try {
        const urlObj = new URL(targetUrl);
        hostname = urlObj.hostname;
        port = parseInt(urlObj.port || '80', 10);
      } catch (err) {
        // use defaults
      }
    }

    const reqOptions = {
      hostname,
      port,
      path: '/api/health',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(reqOptions, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 201);
    });

    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

export async function getRegistryCount(baseUrl?: string): Promise<number> {
  let hostname = ORCHESTRATOR_HOST;
  let port = ORCHESTRATOR_PORT;

  if (baseUrl) {
    try {
      const urlObj = new URL(baseUrl);
      hostname = urlObj.hostname;
      port = parseInt(urlObj.port || '80', 10);
    } catch (err) {
      // use defaults
    }
  }

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname,
      port,
      path: '/api/count',
      method: 'GET',
    };

    const req = http.get(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const body = JSON.parse(data);
            resolve(body.count ?? 0);
          } else {
            reject(new Error(`Failed to get registry count: status ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

export interface Signal {
  type: 'stop' | 'restart' | 'update';
  projectName: string;
  timestamp: string;
  processed: boolean;
}

export async function getSignalsForProject(
  projectName: string,
  targetUrl?: string
): Promise<Signal[]> {
  let hostname = ORCHESTRATOR_HOST;
  let port = ORCHESTRATOR_PORT;

  if (targetUrl) {
    try {
      const urlObj = new URL(targetUrl);
      hostname = urlObj.hostname;
      port = parseInt(urlObj.port || '80', 10);
    } catch (err) {
      // use defaults
    }
  }

  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname,
      port,
      path: `/api/signals/${projectName}`,
      method: 'GET',
    };

    const req = http.get(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const body = JSON.parse(data);
            resolve(body.signals ?? []);
          } else {
            reject(new Error(`Failed to get signals: status ${res.statusCode}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

export async function acknowledgeSignals(projectName: string, targetUrl?: string): Promise<boolean> {
  let hostname = ORCHESTRATOR_HOST;
  let port = ORCHESTRATOR_PORT;

  if (targetUrl) {
    try {
      const urlObj = new URL(targetUrl);
      hostname = urlObj.hostname;
      port = parseInt(urlObj.port || '80', 10);
    } catch (err) {
      // use defaults
    }
  }

  return new Promise((resolve) => {
    const postData = JSON.stringify({ acknowledged: true });

    const reqOptions = {
      hostname,
      port,
      path: `/api/signals/${projectName}/ack`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(reqOptions, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}
