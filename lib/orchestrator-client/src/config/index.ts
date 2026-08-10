import fs from 'fs';
import path from 'path';
import { OrchestratorResponse, PrestartConfig } from '../types';

export function findProjectRoot(currentDir: string = process.cwd()): string {
  let dir = currentDir;
  
  while (dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }

  return currentDir;
}

export function detectProjectName(currentDir: string = process.cwd()): string {
  if (process.env.PROJECT_NAME?.trim()) {
    return process.env.PROJECT_NAME.trim();
  }

  const rootDir = findProjectRoot(currentDir);
  return path.basename(rootDir);
}

export function resolveConfigDir(): string {
  const configuredDir = process.env.ORCHESTRATOR_CONFIG_DIR?.trim();
  if (configuredDir) {
    return path.resolve(configuredDir);
  }

  const rootDir = findProjectRoot(process.cwd());
  return path.resolve(rootDir, 'config');
}

export function resolveConfigFilePath(): string {
  return path.join(resolveConfigDir(), 'app-config.json');
}

export function readExistingAppConfig(): Partial<PrestartConfig> | null {
  try {
    const filePath = resolveConfigFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
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
