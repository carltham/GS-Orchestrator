import fs from 'fs';
import path from 'path';

function findFileRecursive(filename: string, dir: string = process.cwd(), depth: number = 0): string | null {
  if (depth > 4) return null;
  try {
    const target = path.join(dir, filename);
    if (fs.existsSync(target)) return target;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'dist' &&
        entry.name !== 'coverage'
      ) {
        const found = findFileRecursive(filename, path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch (err) {
    // ignore filesystem read errors
  }
  return null;
}

export function resolveBackendCommand(): { command: string; args: string[] } {
  // Check root & subdirectories for backend entry points
  const serverTs = findFileRecursive('server.ts') || findFileRecursive('index.ts');
  if (serverTs) {
    const relPath = path.relative(process.cwd(), serverTs);
    return { command: 'npx', args: ['--yes', 'ts-node', relPath] };
  }

  const serverJs = findFileRecursive('server.js') || findFileRecursive('index.js');
  if (serverJs) {
    const relPath = path.relative(process.cwd(), serverJs);
    return { command: 'node', args: [relPath] };
  }

  return { command: 'node', args: ['dist/server.js'] };
}

export function resolveFrontendCommand(port: number): { command: string; args: string[] } {
  // Check for specialized project dirs
  if (fs.existsSync('GS-Orchestrator-GUI/angular.json')) {
    return { command: 'npm', args: ['--prefix', 'GS-Orchestrator-GUI', 'run', 'dev', '--', '--port', String(port)] };
  }

  const angularJson = findFileRecursive('angular.json');
  if (angularJson) {
    const relDir = path.dirname(path.relative(process.cwd(), angularJson));
    if (relDir && relDir !== '.') {
      return { command: 'npm', args: ['--prefix', relDir, 'run', 'dev', '--', '--port', String(port)] };
    }
    return { command: 'npx', args: ['ng', 'serve', '--port', String(port)] };
  }

  const viteConfig = findFileRecursive('vite.config.ts') || findFileRecursive('vite.config.js');
  if (viteConfig) {
    const relDir = path.dirname(path.relative(process.cwd(), viteConfig));
    if (relDir && relDir !== '.') {
      return { command: 'npx', args: ['vite', relDir, '--port', String(port)] };
    }
    return { command: 'npx', args: ['vite', '--port', String(port)] };
  }

  return { command: 'npx', args: ['ng', 'serve', '--port', String(port)] };
}
