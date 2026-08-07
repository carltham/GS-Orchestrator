import fs from 'fs';
import http from 'http';
import path from 'path';
import {
  isOrchestratorAvailable,
  registerWithOrchestrator,
  sendHealthReport,
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
    test('registers or handles unavailability cleanly', async () => {
      if (orchestratorOnline) {
        const response = await registerWithOrchestrator();
        expect(response).toBeDefined();
        expect(typeof response.backend).toBe('number');
        expect(typeof response.frontend).toBe('number');
        expect(typeof response.database).toBe('number');
      } else {
        await expect(registerWithOrchestrator()).rejects.toThrow();
      }
    });
  });

  describe('Health Telemetry Dispatch', () => {
    test('sends real health report payload', async () => {
      const health: ApplicationHealth = {
        status: 'ok',
        backendStatus: true,
        frontendStatus: true,
        uptimeSeconds: 300,
        ticket: 'IT-TICKET-001',
      };

      const success = await sendHealthReport(health, orchestratorBaseUrl);
      if (orchestratorOnline) {
        expect(success).toBe(true);
      } else {
        expect(success).toBe(false);
      }
    });
  });

  describe('Prestart Execution & Disk Config Persistence', () => {
    test('executes prestart and writes valid app-config.json to disk', async () => {
      const ports = await runPrestart();

      expect(ports).toBeDefined();
      expect(typeof ports.backend).toBe('number');
      expect(typeof ports.frontend).toBe('number');

      const configPath = resolveConfigFilePath();
      expect(fs.existsSync(configPath)).toBe(true);

      const writtenConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(writtenConfig.backend).toBe(ports.backend);
      expect(writtenConfig.frontend).toBe(ports.frontend);
      expect(writtenConfig.database).toBe(ports.database);
      expect(typeof writtenConfig.project).toBe('string');
      expect(writtenConfig.project.length).toBeGreaterThan(0);
      expect(writtenConfig.timestamp).toBeDefined();
    });
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
      expect(typeof ports?.frontend).toBe('number');
    }, 40000);
  });
});


