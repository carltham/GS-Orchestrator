import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface SimulatorPackage {
  name: string;
  main: string;
  scripts?: Record<string, string>;
}

const testingRoot = path.resolve(__dirname, '../..');
const appsRoot = path.join(testingRoot, 'apps');

const simulatorDirectories = fs.readdirSync(appsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

async function waitForHealth(port: number, process: ChildProcess, getOutput: () => string): Promise<any> {
  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    if (process.exitCode !== null) {
      throw new Error(`Simulator exited before becoming healthy.\n${getOutput()}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return response.json();
    } catch {
      // The process may still be binding its port.
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Simulator did not become healthy on port ${port}.\n${getOutput()}`);
}

async function stopSimulator(process: ChildProcess): Promise<void> {
  if (process.exitCode !== null) return;

  process.kill('SIGTERM');
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      process.kill('SIGKILL');
      resolve();
    }, 2000);
    process.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

describe('testing/apps runnable simulator contracts', () => {
  test('contains simulator applications', () => {
    expect(simulatorDirectories.length).toBeGreaterThan(0);
  });

  test.each(simulatorDirectories.map((directory, index) => [directory, 13010 + index]))(
    '%s starts, reports healthy, and stops cleanly',
    async (directory, port) => {
      const appDirectory = path.join(appsRoot, directory as string);
      const packagePath = path.join(appDirectory, 'package.json');

      expect(fs.existsSync(packagePath)).toBe(true);
      const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as SimulatorPackage;
      expect(packageData.name).toBeTruthy();
      expect(packageData.main).toBeTruthy();
      expect(packageData.scripts?.start).toBe(`node ${packageData.main}`);

      const entrypoint = path.join(appDirectory, packageData.main);
      expect(fs.existsSync(entrypoint)).toBe(true);

      let output = '';
      const simulator = spawn(process.execPath, [packageData.main], {
        cwd: appDirectory,
        env: {
          ...process.env,
          PORT: String(port),
          DB_FILE: path.join(appDirectory, 'data', `test-${port}.json`),
          DATABASE_FILE: path.join(appDirectory, 'data', `test-${port}.json`)
        },
        stdio: ['ignore', 'pipe', 'pipe']
      });
      simulator.stdout?.on('data', (chunk) => output += chunk.toString());
      simulator.stderr?.on('data', (chunk) => output += chunk.toString());

      try {
        const health = await waitForHealth(port as number, simulator, () => output);
        expect(health.status).toBe('ok');
      } finally {
        await stopSimulator(simulator);
        fs.rmSync(path.join(appDirectory, 'data', `test-${port}.json`), { force: true });
      }

      expect(simulator.exitCode).toBe(0);
    },
    10000
  );
});