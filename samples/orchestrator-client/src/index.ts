import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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

function detectProjectName(currentDir: string = process.cwd()): string {
  if (process.env.PROJECT_NAME?.trim()) {
    return process.env.PROJECT_NAME.trim();
  }

  const rootDir = findProjectRoot(currentDir);
  return path.basename(rootDir);
}

const ORCHESTRATOR_HOST = process.env.ORCHESTRATOR_HOST || 'localhost';
const ORCHESTRATOR_PORT = parseInt(process.env.ORCHESTRATOR_PORT || '9000', 10);

export function resolveConfigDir(): string {
  const configuredDir = process.env.ORCHESTRATOR_CONFIG_DIR?.trim();
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  // Resolves to calling project's root config directory
  const rootDir = findProjectRoot(process.cwd());
  return path.resolve(rootDir, 'config');
}

export function resolveConfigFilePath(): string {
  return path.join(resolveConfigDir(), 'app-config.json');
}

function detectComponentsAndFrameworks(projectDir: string = process.cwd()): ServiceTypesConfig {
  const detected: ServiceTypesConfig = {};

  try {
    const rootDir = findProjectRoot(projectDir);
    const pkgPath = path.join(rootDir, 'package.json');
    let pkg: any = {};
    if (fs.existsSync(pkgPath)) {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }

    const scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Helper to search recursively in workspace directories
    const hasFileInWorkspace = (filename: string): boolean => {
      // Direct root check
      if (fs.existsSync(path.join(rootDir, filename))) return true;

      const checkRecursive = (dir: string, depth: number): boolean => {
      if (depth > 5) return false;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node-modules' || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'orchestrator-client' || entry.name === 'coverage') {
            continue;
          }
          const fullPath = path.join(dir, entry.name);
          if (entry.name === filename) {
            return true;
          }
          if (entry.isDirectory()) {
            if (fs.existsSync(path.join(fullPath, filename))) {
              return true;
            }
            if (checkRecursive(fullPath, depth + 1)) {
              return true;
            }
          }
        }
      } catch (e) {
        // ignore
      }
      return false;
    };

      return checkRecursive(rootDir, 1);
    };

    // Inspect workspace root package.json AND any subfolder package.json files
    let combinedDeps: Record<string, string> = { ...deps };
    let combinedScripts: Record<string, string> = { ...scripts };

    const scanPackageJsons = (dir: string, depth: number) => {
      if (depth > 5) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git' || entry.name === 'orchestrator-client' || entry.name === 'coverage') continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const subPkgPath = path.join(fullPath, 'package.json');
            if (fs.existsSync(subPkgPath)) {
              try {
                const subPkg = JSON.parse(fs.readFileSync(subPkgPath, 'utf-8'));
                if (subPkg.dependencies) Object.assign(combinedDeps, subPkg.dependencies);
                if (subPkg.devDependencies) Object.assign(combinedDeps, subPkg.devDependencies);
                if (subPkg.scripts) Object.assign(combinedScripts, subPkg.scripts);
              } catch (e) {}
            }
            scanPackageJsons(fullPath, depth + 1);
          }
        }
      } catch (e) {}
    };
    scanPackageJsons(rootDir, 1);

    // 1. Detect Frontend
    if (hasFileInWorkspace('angular.json')) {
      detected.frontend = 'angular';
    } else if (hasFileInWorkspace('vite.config.ts') || hasFileInWorkspace('vite.config.js')) {
      detected.frontend = 'vite';
    } else if (hasFileInWorkspace('next.config.js') || hasFileInWorkspace('next.config.ts')) {
      detected.frontend = 'react';
    } else if (combinedScripts['dev:frontend'] || combinedScripts['start:frontend'] || combinedDeps['@angular/core'] || combinedDeps['react'] || combinedDeps['vue']) {
      detected.frontend = 'frontend';
    }

    // 2. Detect Backend
    if (hasFileInWorkspace('src/server.ts') || hasFileInWorkspace('src/server.js') || combinedScripts['dev:backend'] || combinedScripts['start:backend'] || combinedScripts['server'] || combinedDeps['express'] || combinedDeps['fastify'] || combinedDeps['@nestjs/core'] || combinedDeps['typescript']) {
      detected.backend = 'node-ts';
    } else if (hasFileInWorkspace('requirements.txt') || hasFileInWorkspace('Pipfile') || hasFileInWorkspace('main.py')) {
      detected.backend = 'python';
    }

    // 3. Detect Database
    if (hasFileInWorkspace('prisma/schema.prisma') || hasFileInWorkspace('docker-compose.yml') || hasFileInWorkspace('docker-compose.dev.yml') || combinedDeps['pg'] || combinedDeps['typeorm'] || combinedDeps['knex']) {
      detected.database = 'postgres';
    }
  } catch (err) {
    // Ignore detection errors, fallback handles defaults
  }

  return detected;
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

  // Inspect workspace directory for components if not explicitly provided
  const autoDetected = serviceTypesParam ? {} : detectComponentsAndFrameworks(process.cwd());

  // Build serviceTypes from parameters, env vars, or auto-detection
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

  // Fallback to standard full-stack defaults if nothing detected or configured
  if (Object.keys(targetServiceTypes).length === 0) {
    targetServiceTypes.backend = 'node-ts';
  }

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      projectName: projectName,
      path: process.cwd(),
      serviceTypes: targetServiceTypes,
      basePorts: basePortsParam,
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
    const options = {
      hostname,
      port,
      path: '/api/count',
      method: 'GET',
    };

    const req = http.get(options, (res) => {
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

    req.on('error', (err) => {
      reject(err);
    });

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

export async function attemptStartupHandler(): Promise<boolean> {
  const rootDir = findProjectRoot(process.cwd());

  const tsFileRoot = path.join(rootDir, 'startupHandler.ts');
  const jsFileRoot = path.join(rootDir, 'startupHandler.js');
  const tsFileScripts = path.join(rootDir, 'scripts', 'startupHandler.ts');
  const jsFileScripts = path.join(rootDir, 'scripts', 'startupHandler.js');

  let command = '';
  let args: string[] = [];

  if (fs.existsSync(tsFileRoot)) {
    command = 'npx';
    args = ['ts-node', tsFileRoot];
  } else if (fs.existsSync(jsFileRoot)) {
    command = 'node';
    args = [jsFileRoot];
  } else if (fs.existsSync(tsFileScripts)) {
    command = 'npx';
    args = ['ts-node', tsFileScripts];
  } else if (fs.existsSync(jsFileScripts)) {
    command = 'node';
    args = [jsFileScripts];
  } else {
    // Check package.json scripts
    const pkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.scripts && (pkg.scripts['startupHandler'] || pkg.scripts['startup-handler'])) {
          const scriptName = pkg.scripts['startupHandler'] ? 'startupHandler' : 'startup-handler';
          command = 'npm';
          args = ['run', scriptName];
        }
      } catch (e) {
        // ignore JSON parse error
      }
    }
  }

  if (!command) {
    console.warn('⚠️  No local startup handler found in project root or scripts');
    return false;
  }

  console.log(`🚀 Executing local startup handler: ${command} ${args.join(' ')}...`);
  try {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      detached: true,
    });
    child.unref();

    // Poll for up to 10 seconds for orchestrator to become available
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 500));
      const available = await isOrchestratorAvailable();
      if (available) {
        console.log('✅ GS-Orchestrator successfully started by startup handler!');
        return true;
      }
    }
  } catch (err) {
    console.error('❌ Failed to execute startup handler:', err);
  }

  return false;
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
    console.warn(`⚠️  GS-Orchestrator unavailable on http://${ORCHESTRATOR_HOST}:${ORCHESTRATOR_PORT}. Attempting startup handler...`);
    const recovered = await attemptStartupHandler();
    if (recovered) {
      try {
        const ports = await registerWithOrchestrator();
        writeConfig(ports);
        console.log(`✅ Prestart agent complete after startup handler recovery`);
        return ports;
      } catch (retryErr) {
        // Fall through to exception
      }
    }

    throw new Error(
      `Fatal: GS-Orchestrator is unavailable on http://${ORCHESTRATOR_HOST}:${ORCHESTRATOR_PORT} ` +
        `and no valid startup handler could restore it. Aborting process.`
    );
  }
}

if (require.main === module) {
  runPrestart();
}
