import fs from 'fs';
import http from 'http';
import path from 'path';
import {
  isOrchestratorAvailable,
  attemptStartupHandler,
  registerWithOrchestrator,
  sendHealthReport,
  getRegistryCount,
  runPrestart,
  resolveConfigFilePath,
  ApplicationHealth,
} from '../src/index';
import { OrchestratedLauncher } from '../src/launcher';

/**
 * True Integration Test Suite for @gs/orchestrator-client.
 *
 * This test suite makes real HTTP connections to the GS-Orchestrator service
 * on the configured host/port (defaulting to http://localhost:9000).
 * It tests live behavior when the orchestrator service is running, and
 * fallback resilience when it is unavailable.
 */
describe('OrchestratorClient - Real Integration Test Suite (IT)', () => {
  const host = process.env.ORCHESTRATOR_HOST || 'localhost';
  const port = parseInt(process.env.ORCHESTRATOR_PORT || '9000', 10);
  const orchestratorBaseUrl = `http://${host}:${port}`;

  let orchestratorOnline = false;

  beforeAll(async () => {
    // Probe real orchestrator service
    orchestratorOnline = await isOrchestratorAvailable(orchestratorBaseUrl);
    if (orchestratorOnline) {
      console.log(`📡 GS-Orchestrator detected as LIVE on ${orchestratorBaseUrl}`);
    } else {
      console.log(`🔌 GS-Orchestrator NOT detected on ${orchestratorBaseUrl} — testing fallback resilience`);
    }
  });

  describe('Real Service Discovery & Health Check', () => {
    test('checks real orchestrator availability', async () => {
      const available = await isOrchestratorAvailable(orchestratorBaseUrl);
      expect(typeof available).toBe('boolean');
      expect(available).toBe(orchestratorOnline);
    });
  });

  describe('Registration Workflow', () => {
    test('recreates registry file when missing and registers successfully', async () => {
      if (orchestratorOnline) {
        const registryPath = path.resolve(__dirname, '../../../GS-Orchestrator/registry.json');
        if (fs.existsSync(registryPath)) {
          fs.unlinkSync(registryPath);
        }

        const countBefore = await getRegistryCount(orchestratorBaseUrl);

        const response = await registerWithOrchestrator();
        expect(response).toBeDefined();
        expect(typeof response.backend).toBe('number');

        const countAfter = await getRegistryCount(orchestratorBaseUrl);
        expect(countAfter).toBeGreaterThanOrEqual(countBefore);
      } else {
        await expect(registerWithOrchestrator()).rejects.toThrow();
      }
    });

    test('registers or handles unavailability cleanly', async () => {
      if (orchestratorOnline) {
        const countBefore = await getRegistryCount(orchestratorBaseUrl);

        const response = await registerWithOrchestrator();
        expect(response).toBeDefined();
        expect(typeof response.backend).toBe('number');

        const countAfter = await getRegistryCount(orchestratorBaseUrl);
        expect(countAfter).toBeGreaterThanOrEqual(countBefore);
      } else {
        await expect(registerWithOrchestrator()).rejects.toThrow();
      }
    });

    test('registers under custom PROJECT_NAME "TestProject123" and custom basePorts via API', async () => {
      if (orchestratorOnline) {
        const countBefore = await getRegistryCount(orchestratorBaseUrl);

        process.env.PROJECT_NAME = 'TestProject123';

        try {
          const response = await registerWithOrchestrator({
            serviceTypes: {
              backend: 'node-ts',
              database: 'postgres',
            },
            basePorts: {
              backend: 3100,
              database: 5500,
            },
          });
          expect(response).toBeDefined();
          expect(response.backend).toBeGreaterThanOrEqual(3100);
          expect(response.database).toBeGreaterThanOrEqual(5500);

          const countAfter = await getRegistryCount(orchestratorBaseUrl);
          expect(countAfter).toBeGreaterThanOrEqual(countBefore);
        } finally {
          delete process.env.PROJECT_NAME;
        }
      }
    });
  });

  describe('Health Telemetry Dispatch', () => {
    test('sends real health report payload', async () => {
      const online = await isOrchestratorAvailable(orchestratorBaseUrl);
      if (!online) {
        await attemptStartupHandler();
      }

      await registerWithOrchestrator();

      const health: ApplicationHealth = {
        status: 'ok',
        backendStatus: true,
        frontendStatus: true,
        uptimeSeconds: 300,
        ticket: 'IT-TICKET-001',
      };

      const success = await sendHealthReport(health, orchestratorBaseUrl);
      expect(success).toBe(true);
    }, 15000);
  });

  describe('Prestart Execution & Disk Config Persistence', () => {
    test('executes prestart and writes valid app-config.json to disk', async () => {
      const ports = await runPrestart();

      expect(ports).toBeDefined();
      expect(typeof ports.backend).toBe('number');

      const configPath = resolveConfigFilePath();
      expect(fs.existsSync(configPath)).toBe(true);

      const writtenConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(writtenConfig.backend).toBe(ports.backend);
      expect(typeof writtenConfig.project).toBe('string');
      expect(writtenConfig.project.length).toBeGreaterThan(0);
      expect(writtenConfig.timestamp).toBeDefined();
    }, 15000);
  });

  describe('Full Application Orchestration (Backend & Frontend Startup)', () => {
    let launcher: OrchestratedLauncher;

    afterEach(() => {
      if (launcher) {
        launcher.stop();
      }
    });

    test('spawns backend and frontend services via OrchestratedLauncher', async () => {
      launcher = new OrchestratedLauncher();

      // Start launcher and await its startup process
      await launcher.start();

      const ports = launcher.getPorts();
      expect(ports).toBeDefined();
      expect(typeof ports?.backend).toBe('number');
    }, 40000);
  });
});


