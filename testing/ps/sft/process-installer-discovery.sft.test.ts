import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateProcessAdapter } from '../../../lib/process-server/src/generators/adapterGenerator';

const installer = require('../../../lib/process-server/src/templates/install.js');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

describe('Process installer workspace discovery', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-installer-'));
    writeJson(path.join(rootDir, 'package.json'), {
      name: 'shopper-fixture',
      scripts: { start: 'node original.js' },
      workspaces: ['apps/backend', 'apps/frontend/web', 'apps/shared', 'apps/mobile']
    });
    writeJson(path.join(rootDir, 'config', 'app-config.json'), {
      backend: 3001,
      frontend: 5173,
      database: 5433
    });
    writeJson(path.join(rootDir, 'apps', 'backend', 'package.json'), {
      name: 'fixture-backend',
      scripts: { dev: 'ts-node src/index.ts' },
      dependencies: { express: '^4.0.0' }
    });
    writeJson(path.join(rootDir, 'apps', 'frontend', 'web', 'package.json'), {
      name: 'fixture-web',
      scripts: { dev: 'vite' },
      dependencies: { vite: '^5.0.0' }
    });
    writeJson(path.join(rootDir, 'apps', 'shared', 'package.json'), {
      name: 'fixture-shared',
      scripts: { build: 'tsc' }
    });
    writeJson(path.join(rootDir, 'apps', 'mobile', 'package.json'), {
      name: 'fixture-mobile',
      scripts: { dev: 'ns run android' },
      dependencies: { '@nativescript/core': '^8.0.0' }
    });
    fs.writeFileSync(path.join(rootDir, 'docker-compose.dev.yml'), [
      "version: '3.8'",
      'services:',
      '  postgres:',
      '    image: postgres:15-alpine',
      '    ports:',
      '      - "5433:5432"',
      'volumes:',
      '  postgres_data:',
      '    driver: local'
    ].join('\n'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  test('discovers nested runtime workspaces and one compose database', () => {
    const components = installer.discoverComponents(rootDir);

    expect(components).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'backend', relativePath: 'apps/backend', configuredPort: 3001 }),
      expect.objectContaining({ name: 'frontend', relativePath: 'apps/frontend/web', configuredPort: 5173 }),
      expect.objectContaining({ name: 'database', serviceType: 'database', configuredPort: 5433 })
    ]));
    expect(components).toHaveLength(3);
  });

  test('generates one adapter containing every discovered component', () => {
    const components = installer.discoverComponents(rootDir);
    const adapter = generateProcessAdapter({
      workspaceDir: rootDir,
      projectName: 'shopper-fixture',
      hasPackageJson: true,
      components
    });

    expect(adapter).toContain('class ProcessAdapter');
    expect(adapter).toContain('this.componentDefinitions');
    expect(adapter).toContain('apps/backend');
    expect(adapter).toContain('apps/frontend/web');
    expect(adapter).toContain('docker-compose.dev.yml');
  });

  test('backs up the manifest and preserves the original start script for manual restoration', () => {
    const backupPath = installer.createPackageBackup(rootDir);
    installer.configureStartup(rootDir, 'node original.js');

    const updated = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    expect(updated.scripts.start).toBe('node node_modules/@gs/process-client/dist/index.js');
    expect(updated.scripts['start:before-process-client']).toBe('node original.js');
    expect(backup.scripts.start).toBe('node original.js');
  });
});
