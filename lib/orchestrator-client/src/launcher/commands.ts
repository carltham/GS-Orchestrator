import fs from 'fs';

export function resolveBackendCommand(): { command: string; args: string[] } {
  if (fs.existsSync('src/server.ts')) {
    return { command: 'npx', args: ['--yes', 'ts-node', 'src/server.ts'] };
  }
  if (fs.existsSync('server.js')) {
    return { command: 'node', args: ['server.js'] };
  }
  return { command: 'node', args: ['dist/server.js'] };
}

export function resolveFrontendCommand(port: number): { command: string; args: string[] } {
  if (fs.existsSync('GS-Orchestrator-GUI/angular.json')) {
    return { command: 'npm', args: ['--prefix', 'GS-Orchestrator-GUI', 'run', 'dev', '--', '--port', String(port)] };
  }
  if (fs.existsSync('angular.json')) {
    return { command: 'npx', args: ['ng', 'serve', '--port', String(port)] };
  }
  if (fs.existsSync('vite.config.ts') || fs.existsSync('vite.config.js')) {
    return { command: 'npx', args: ['vite', '--port', String(port)] };
  }
  return { command: 'npx', args: ['ng', 'serve', '--port', String(port)] };
}
