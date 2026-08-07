import http from 'http';
import fs from 'fs';
import path from 'path';

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

function findProjectRoot(currentDir: string = process.cwd()): string {
  let dir = currentDir;
  
  while (dir !== path.parse(dir).root) {
    // If we reach a .git directory or workspace-level folder, stop
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return currentDir;
}

function detectProjectName(): string {
  if (process.env.PROJECT_NAME?.trim()) {
    return process.env.PROJECT_NAME.trim();
  }

  const rootDir = findProjectRoot();
  return path.basename(rootDir);
}

const ORCHESTRATOR_HOST = process.env.ORCHESTRATOR_HOST || 'localhost';
const ORCHESTRATOR_PORT = parseInt(process.env.ORCHESTRATOR_PORT || '9000', 10);

export function resolveConfigDir(): string {
  const configuredDir = process.env.ORCHESTRATOR_CONFIG_DIR?.trim();
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  // Resolves to calling project's root config directory (relative to CWD)
  return path.resolve(process.cwd(), 'config');
}

export function resolveConfigFilePath(): string {
  return path.join(resolveConfigDir(), 'app-config.json');
}

export async function registerWithOrchestrator(): Promise<OrchestratorResponse> {
  const projectName = detectProjectName();

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      projectName: projectName,
      path: process.cwd(),
    });

    const options = {
      hostname: ORCHESTRATOR_HOST,
      port: ORCHESTRATOR_PORT,
      path: '/api/register',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
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
            reject(
              new Error(`Orchestrator returned ${res.statusCode}: ${data}`)
            );
          }
        } catch (error) {
          reject(new Error(`Failed to parse Orchestrator response: ${error}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

export async function sendHealthReport(health: ApplicationHealth, targetUrl?: string): Promise<boolean> {
  const projectName = detectProjectName();

  return new Promise((resolve) => {
    const postData = JSON.stringify({
      projectName: projectName,
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

    const options = {
      hostname,
      port,
      path: '/api/health',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 201);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

export function writeConfig(ports: OrchestratorResponse): void {
  const projectName = detectProjectName();

  const config: PrestartConfig = {
    backend: ports.backend,
    frontend: ports.frontend,
    database: ports.database,
    ticket: ports.ticket,
    timestamp: ports.timestamp || new Date().toISOString(),
    project: projectName,
  };

  const configDir = resolveConfigDir();
  const configFile = resolveConfigFilePath();

  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  console.log(`✅ Prestart config written to ${configFile}`);
  console.log(`   Backend: ${config.backend}`);
  console.log(`   Frontend: ${config.frontend}`);
  console.log(`   Database: ${config.database}`);
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

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

export async function runPrestart(): Promise<OrchestratorResponse> {
  const componentArg = process.argv[2];

  if (!componentArg || !['backend', 'frontend', 'mobile'].includes(componentArg)) {
    console.warn('⚠️  No component specified (backend|frontend|mobile), proceeding anyway');
  }

  try {
    console.log(`🔍 Prestart agent: Querying GS-Orchestrator on ${ORCHESTRATOR_HOST}:${ORCHESTRATOR_PORT}...`);
    const ports = await registerWithOrchestrator();
    writeConfig(ports);
    console.log(`✅ Prestart agent complete`);
    return ports;
  } catch (error) {
    console.warn(`⚠️  Orchestrator unavailable, using fallback ports`);
    const fallbackPorts: OrchestratorResponse = {
      backend: 3000,
      frontend: 5173,
      database: 5433,
      ticket: 'fallback',
      timestamp: new Date().toISOString(),
    };
    writeConfig(fallbackPorts);
    console.log(`✅ Prestart agent complete (fallback)`);
    return fallbackPorts;
  }
}

if (require.main === module) {
  runPrestart();
}
