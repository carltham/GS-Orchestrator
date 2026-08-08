import fs from 'fs';
import path from 'path';
import { findProjectRoot } from '../config';
import { ServiceTypesConfig } from '../types';

export function detectComponentsAndFrameworks(projectDir: string = process.cwd()): ServiceTypesConfig {
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

    const hasFileInWorkspace = (filename: string): boolean => {
      if (fs.existsSync(path.join(rootDir, filename))) return true;

      const checkRecursive = (dir: string, depth: number): boolean => {
        if (depth > 5) return false;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (
              entry.name === 'node-modules' ||
              entry.name === 'node_modules' ||
              entry.name === 'dist' ||
              entry.name === '.git' ||
              entry.name === 'orchestrator-client' ||
              entry.name === 'coverage'
            ) {
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

    let combinedDeps: Record<string, string> = { ...deps };
    let combinedScripts: Record<string, string> = { ...scripts };

    const scanPackageJsons = (dir: string, depth: number) => {
      if (depth > 5) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.name === 'node_modules' ||
            entry.name === 'dist' ||
            entry.name === '.git' ||
            entry.name === 'orchestrator-client' ||
            entry.name === 'coverage'
          )
            continue;
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
    } else if (
      combinedScripts['dev:frontend'] ||
      combinedScripts['start:frontend'] ||
      combinedDeps['@angular/core'] ||
      combinedDeps['react'] ||
      combinedDeps['vue']
    ) {
      detected.frontend = 'frontend';
    }

    // 2. Detect Backend
    if (
      hasFileInWorkspace('src/server.ts') ||
      hasFileInWorkspace('src/server.js') ||
      combinedScripts['dev:backend'] ||
      combinedScripts['start:backend'] ||
      combinedScripts['server'] ||
      combinedDeps['express'] ||
      combinedDeps['fastify'] ||
      combinedDeps['@nestjs/core'] ||
      combinedDeps['typescript']
    ) {
      detected.backend = 'node-ts';
    } else if (
      hasFileInWorkspace('requirements.txt') ||
      hasFileInWorkspace('Pipfile') ||
      hasFileInWorkspace('main.py')
    ) {
      detected.backend = 'python';
    }

    // 3. Detect Database
    if (
      hasFileInWorkspace('prisma/schema.prisma') ||
      hasFileInWorkspace('docker-compose.yml') ||
      hasFileInWorkspace('docker-compose.dev.yml') ||
      combinedDeps['pg'] ||
      combinedDeps['typeorm'] ||
      combinedDeps['knex']
    ) {
      detected.database = 'postgres';
    }
  } catch (err) {
    // Ignore detection errors, fallback handles defaults
  }

  return detected;
}
