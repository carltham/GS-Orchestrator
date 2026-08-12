import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

describe('GS-Orchestrator - Combined Simulated Templates Integration SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'SIT-Dynamic-Simulated-Combo-App';

  const WORKspaceRoot = path.resolve(__dirname, '../../..');
  const tempAppsDir = path.join(WORKspaceRoot, 'testing', 'temp-apps');
  const testAppDir = path.join(tempAppsDir, 'dynamic-combo-app');

  const spawnedProcesses: ChildProcess[] = [];

  beforeAll(() => {
    // Check and create temp-apps directory
    if (!fs.existsSync(tempAppsDir)) {
      fs.mkdirSync(tempAppsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Kill any processes spawned for this test cleanly
    while (spawnedProcesses.length > 0) {
      const proc = spawnedProcesses.pop();
      if (proc) {
        try {
          proc.kill('SIGTERM');
        } catch (e) {
          // ignore error
        }
      }
    }

    // Clean up temporary application copy
    if (fs.existsSync(testAppDir)) {
      try {
        fs.rmSync(testAppDir, { recursive: true, force: true });
      } catch (err) {
        console.warn('⚠️ Clear temp app warning:', err);
      }
    }
  });

  function copyFolderRecursiveSync(src: string, dest: string) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyFolderRecursiveSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  test('should successfully assemble, register, and run a combo of Frontend, Backend, and FileDB templates', async () => {
    // 1. Setup Combined Project Directories
    if (fs.existsSync(testAppDir)) {
      fs.rmSync(testAppDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testAppDir, { recursive: true });

    const srcTemplatesDir = path.join(WORKspaceRoot, 'testing', 'apps');

    // Combine all three: Frontend, Backend, and FileDB
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-frontend-template'), path.join(testAppDir, 'frontend'));
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-backend-template'), path.join(testAppDir, 'backend'));
    copyFolderRecursiveSync(path.join(srcTemplatesDir, 'simulated-filedb-template'), path.join(testAppDir, 'filedb'));

    // Verify folders copy correctly
    expect(fs.existsSync(path.join(testAppDir, 'frontend', 'server.js'))).toBe(true);
    expect(fs.existsSync(path.join(testAppDir, 'backend', 'server.js'))).toBe(true);
    expect(fs.existsSync(path.join(testAppDir, 'filedb', 'server.js'))).toBe(true);

    // 2. Query GS-Orchestrator to register the project and get non-conflicting dynamic port allocations
    const registerPayload = {
      projectName: PROJECT_NAME,
      path: testAppDir,
      serviceTypes: {
        frontend: 'node-ts', // maps frontend requirement to a registration port key
        backend: 'node-ts',  // maps backend requirement to a registration port key
        database: 'filedb'   // maps database requirement to a registration port key
      }
    };

    const registerRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload)
    });

    expect(registerRes.status).toBe(201);
    const registerBody = (await registerRes.json()) as any;
    expect(registerBody.ports).toBeDefined();

    const frontendPort = registerBody.ports.frontend;
    const backendPort = registerBody.ports.backend;
    const databasePort = registerBody.ports.database;

    expect(frontendPort).toBeDefined();
    expect(backendPort).toBeDefined();
    expect(databasePort).toBeDefined();

    console.log(`[TEST COMBO] Allocated Ports: Frontend:${frontendPort}, Backend:${backendPort}, DB:${databasePort}`);

    // 3. Spawn FileDB Template microservice physically with assigned database port
    const fileDbProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'filedb'),
      env: {
        ...process.env,
        PORT: String(databasePort),
        DB_FILE: path.join(testAppDir, 'filedb', 'data', 'store.json')
      }
    });
    spawnedProcesses.push(fileDbProc);

    // Spawn Backend Template microservice physically with assigned backend port and databases variables
    const backendProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'backend'),
      env: {
        ...process.env,
        PORT: String(backendPort),
        database: String(databasePort)
      }
    });
    spawnedProcesses.push(backendProc);

    // Spawn Frontend Template microservice physically with assigned ports
    const frontendProc = spawn('node', ['server.js'], {
      cwd: path.join(testAppDir, 'frontend'),
      env: {
        ...process.env,
        PORT: String(frontendPort),
        backend: String(backendPort)
      }
    });
    spawnedProcesses.push(frontendProc);

    // Allow servers a brief window to bind to ports and startup
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 4. Verify Live Interaction - Endpoint checks on running combined microservices!
    // Connect to FileDB and confirm seed records exist
    const fileDbHealthRes = await fetch(`http://localhost:${databasePort}/health`);
    expect(fileDbHealthRes.status).toBe(200);
    const fileDbHealth = (await fileDbHealthRes.json()) as any;
    expect(fileDbHealth.status).toBe('ok');
    expect(fileDbHealth.type).toBe('filedb');

    const dbQueryRes = await fetch(`http://localhost:${databasePort}/records`);
    expect(dbQueryRes.status).toBe(200);
    const dataRecords = (await dbQueryRes.json()) as any;
    expect(dataRecords.length).toBeGreaterThan(0);
    expect(dataRecords[0].name).toContain('Initial Seed Record');

    // Connect to Backend and check CORS mapping and proxy output to FileDB
    const devHealthRes = await fetch(`http://localhost:${backendPort}/health`);
    expect(devHealthRes.status).toBe(200);
    const devHealth = (await devHealthRes.json()) as any;
    expect(devHealth.status).toBe('ok');
    expect(devHealth.type).toBe('backend');

    // Backend queries API items proxying request directly to FileDB running instance!
    const backendItemsRes = await fetch(`http://localhost:${backendPort}/api/items`);
    expect(backendItemsRes.status).toBe(200);
    const backendItems = (await backendItemsRes.json()) as any;
    expect(backendItems.length).toEqual(dataRecords.length);
    expect(backendItems[0].name).toEqual(dataRecords[0].name);

    // Connect to Frontend and fetch simulated HTML landing contents referencing configured ports
    const mainHtmlRes = await fetch(`http://localhost:${frontendPort}/`);
    expect(mainHtmlRes.status).toBe(200);
    const mainHtml = await mainHtmlRes.text();
    expect(mainHtml).toContain('Simulated Frontend Template');
    expect(mainHtml).toContain(`http://localhost:${backendPort}/api/items`);

    console.log('✅ Combined Template Lifecycle execution validation completed successfully!');
  });
});
