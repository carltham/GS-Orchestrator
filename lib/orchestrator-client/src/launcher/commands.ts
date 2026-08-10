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
    return { command: 'node', args: ['-r', 'ts-node/register', relPath] };
  }

  const serverJs = findFileRecursive('server.js') || findFileRecursive('index.js');
  if (serverJs) {
    const relPath = path.relative(process.cwd(), serverJs);
    return { command: 'node', args: [relPath] };
  }

  return { command: 'node', args: ['dist/server.js'] };
}

export function resolveFrontendCommand(port: number): { command: string; args: string[] } {
  const angularJson = findFileRecursive('angular.json');
  if (angularJson) {
    const relDir = path.dirname(path.relative(process.cwd(), angularJson));
    const binPath = path.join(relDir && relDir !== '.' ? relDir : '.', 'node_modules', '.bin', 'ng');
    if (fs.existsSync(binPath)) {
      return { command: binPath, args: ['serve', '--port', String(port)] };
    }
    return { command: 'ng', args: ['serve', '--port', String(port)] };
  }

  const viteConfig = findFileRecursive('vite.config.ts') || findFileRecursive('vite.config.js');
  if (viteConfig) {
    const relDir = path.dirname(path.relative(process.cwd(), viteConfig));
    const binPath = path.join(relDir && relDir !== '.' ? relDir : '.', 'node_modules', '.bin', 'vite');
    if (fs.existsSync(binPath)) {
      return { command: binPath, args: ['--port', String(port)] };
    }
    return { command: 'vite', args: ['--port', String(port)] };
  }

  return { command: 'node', args: ['dist/frontend/index.js'] };
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
