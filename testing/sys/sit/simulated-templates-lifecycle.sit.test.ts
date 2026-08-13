import * as fs from 'fs';
import * as path from 'path';
import { ChildProcess } from 'child_process';
import {
  prepareSelectedProject,
  spawnSimulatedMicroservices,
  teardownSimulatedMicroservices
} from '../../src/SimulatedAppHelper';

describe('GS-Orchestrator - Combined Simulated Templates Integration SIT', () => {
  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const BASE_PROJECT_NAME = 'SIT-Combo-App';

  const WORKspaceRoot = path.resolve(__dirname, '../../..');
  const tempAppsDir = path.join(WORKspaceRoot, 'testing', 'temp-apps');

  let spawnedProcesses: ChildProcess[] = [];
  let currentTestAppDir = '';

  beforeAll(() => {
    if (!fs.existsSync(tempAppsDir)) {
      fs.mkdirSync(tempAppsDir, { recursive: true });
    }
  });

  afterEach(() => {
    teardownSimulatedMicroservices(spawnedProcesses, currentTestAppDir);
  });

  // Helper run function to test a specific combo in complete isolation
  async function runComboTest(
    comboName: string,
    services: { frontend?: boolean; backend?: boolean; database?: boolean },
    verifyFn: (ports: { frontend?: number; backend?: number; database?: number }) => Promise<void>
  ) {
    const projectName = `${BASE_PROJECT_NAME}-${comboName}`;
    currentTestAppDir = path.join(tempAppsDir, projectName);

    // 1. Prepare folder mapping
    prepareSelectedProject(WORKspaceRoot, tempAppsDir, currentTestAppDir, services);

    // 2. Query GS-Orchestrator to register only the selected services
    const serviceTypes: Record<string, string> = {};
    if (services.frontend) serviceTypes.frontend = 'frontend';
    if (services.backend) serviceTypes.backend = 'backend';
    if (services.database) serviceTypes.database = 'database';

    const registerPayload = {
      projectName,
      path: currentTestAppDir,
      serviceTypes
    };

    const registerRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload)
    });

    expect(registerRes.status).toBe(201);
    const registerBody = (await registerRes.json()) as any;
    expect(registerBody.ports).toBeDefined();

    // 3. Spawn only the selected microservices
    spawnedProcesses = spawnSimulatedMicroservices(currentTestAppDir, {
      frontend: registerBody.ports.frontend,
      backend: registerBody.ports.backend,
      database: registerBody.ports.database
    });

    // Provide startup window
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Perform dynamic custom assertions
    await verifyFn(registerBody.ports);
  }

  // --- Combination 0: Empty Set (No services) ---
  test('Combination 0: Empty Set (No services)', async () => {
    await runComboTest('EmptySet', {}, async (ports) => {
      expect(ports).toBeDefined();
      expect(Object.keys(ports || {})).toHaveLength(0);
    });
  });

  // --- Single-Component Scenarios (1-Tier) ---
  test('Combination 1: Database (FileDB) Only', async () => {
    await runComboTest('DBOnly', { database: true }, async (ports) => {
      expect(ports.database).toBeDefined();
      expect(ports.frontend).toBeUndefined();
      expect(ports.backend).toBeUndefined();

      // Verify db is functional standalone
      const healthRes = await fetch(`http://localhost:${ports.database}/health`);
      expect(healthRes.status).toBe(200);
      const health = await healthRes.json() as any;
      expect(health.type).toBe('filedb');

      const recordsRes = await fetch(`http://localhost:${ports.database}/records`);
      expect(recordsRes.status).toBe(200);
      const records = await recordsRes.json() as any;
      expect(records.length).toBeGreaterThan(0);
    });
  });

  test('Combination 2: Backend Only (In Offline Fallback mode)', async () => {
    await runComboTest('BackendOnly', { backend: true }, async (ports) => {
      expect(ports.backend).toBeDefined();
      expect(ports.frontend).toBeUndefined();
      expect(ports.database).toBeUndefined();

      // Verify backend works in filesystem backup/fallback mode
      const healthRes = await fetch(`http://localhost:${ports.backend}/health`);
      expect(healthRes.status).toBe(200);
      const health = await healthRes.json() as any;
      expect(health.type).toBe('backend');

      const itemsRes = await fetch(`http://localhost:${ports.backend}/api/items`);
      expect(itemsRes.status).toBe(200);
      const items = await itemsRes.json() as any;
      expect(Array.isArray(items)).toBe(true);
    });
  });

  test('Combination 3: Frontend Only', async () => {
    await runComboTest('FrontendOnly', { frontend: true }, async (ports) => {
      expect(ports.frontend).toBeDefined();
      expect(ports.backend).toBeUndefined();
      expect(ports.database).toBeUndefined();

      // Verify frontend loads standard index mapping
      const res = await fetch(`http://localhost:${ports.frontend}/`);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('Simulated Frontend Template');
    });
  });

  // --- Coupled Scenarios (2-Tier) ---
  test('Combination 4: Backend + Database (No UI)', async () => {
    await runComboTest('BackendAndDB', { backend: true, database: true }, async (ports) => {
      expect(ports.backend).toBeDefined();
      expect(ports.database).toBeDefined();
      expect(ports.frontend).toBeUndefined();

      // Verify Backend successfully proxies data queries to live FileDB
      const itemsRes = await fetch(`http://localhost:${ports.backend}/api/items`);
      expect(itemsRes.status).toBe(200);
      const items = await itemsRes.json() as any;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].name).toContain('Seed Record');
    });
  });

  test('Combination 5: Frontend + Backend (No DB - Backend File Fallback)', async () => {
    await runComboTest('FrontendAndBackend', { frontend: true, backend: true }, async (ports) => {
      expect(ports.frontend).toBeDefined();
      expect(ports.backend).toBeDefined();
      expect(ports.database).toBeUndefined();

      // Frontend is loaded and lists port parameters of the backend
      const mainHtmlRes = await fetch(`http://localhost:${ports.frontend}/`);
      expect(mainHtmlRes.status).toBe(200);
      const mainHtml = await mainHtmlRes.text();
      expect(mainHtml).toContain(`http://localhost:${ports.backend}/api/items`);
    });
  });

  test('Combination 6: Frontend + Database (No Backend)', async () => {
    await runComboTest('FrontendAndDB', { frontend: true, database: true }, async (ports) => {
      expect(ports.frontend).toBeDefined();
      expect(ports.database).toBeDefined();
      expect(ports.backend).toBeUndefined();

      // DB is online, Frontend is online, but frontend hits "offline" script because backend lacks active port setup
      const dbRes = await fetch(`http://localhost:${ports.database}/health`);
      expect(dbRes.status).toBe(200);
      const mainHtmlRes = await fetch(`http://localhost:${ports.frontend}/`);
      expect(mainHtmlRes.status).toBe(200);
    });
  });

  // --- Fully Integrated Scenario (3-Tier) ---
  test('Combination 7: E2E Fully Integrated Combo (Frontend + Backend + DB)', async () => {
    await runComboTest('FullIntegrated', { frontend: true, backend: true, database: true }, async (ports) => {
      expect(ports.frontend).toBeDefined();
      expect(ports.backend).toBeDefined();
      expect(ports.database).toBeDefined();

      // 1. FileDB health
      const dbRes = await fetch(`http://localhost:${ports.database}/health`);
      expect(dbRes.status).toBe(200);

      // 2. Query DB Records via Backend Proxy
      const backendItemsRes = await fetch(`http://localhost:${ports.backend}/api/items`);
      expect(backendItemsRes.status).toBe(200);
      const items = await backendItemsRes.json() as any;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0].name).toContain('Initial Seed Record');

      // 3. Frontend loads index pointing to Backend
      const mainHtmlRes = await fetch(`http://localhost:${ports.frontend}/`);
      expect(mainHtmlRes.status).toBe(200);
      const htmlText = await mainHtmlRes.text();
      expect(htmlText).toContain(`http://localhost:${ports.backend}/api/items`);
    });
  });
});
