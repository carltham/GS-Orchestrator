import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { app, registry, serverScanner, SELF_PROJECT_NAME } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator Server SFT - Project Registration & Port Allocation', () => {
  const dbDir = path.join(__dirname, '..', '..', '..', 'db');
  const registryPath = path.join(dbDir, 'registry.json');
  const unregisteredPath = path.join(dbDir, 'unregistered-servers.json');

  beforeEach(() => {
    if (fs.existsSync(registryPath)) {
      fs.writeFileSync(
        registryPath,
        JSON.stringify({ projects: {}, nextPortBase: 4200, lastUpdated: new Date().toISOString() }, null, 2)
      );
    }
    if (fs.existsSync(unregisteredPath)) {
      fs.writeFileSync(
        unregisteredPath,
        JSON.stringify({ lastScanned: new Date().toISOString(), servers: [] }, null, 2)
      );
    }
  });

  test('rejects registration with missing parameters', async () => {
    const res = await request(app).post('/orch/project/register').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required fields');
  });

  test('registers a standard full-stack project and allocates dynamic ports', async () => {
    // Mock scanner loadData to avoid system database port conflicts during test execution
    const origLoadData = serverScanner.loadData.bind(serverScanner);
    serverScanner.loadData = () => ({ lastScanned: new Date().toISOString(), servers: [] });

    const payload = {
      projectName: 'TestApp',
      path: '/tmp/testapp',
      serviceTypes: {
        backend: 'node-ts',
        frontend: 'vite',
        database: 'postgres',
      },
    };

    const res = await request(app).post('/orch/project/register').send(payload);
    serverScanner.loadData = origLoadData; // Restore scanner method

    expect(res.status).toBe(201);
    expect(res.body.ports).toBeDefined();
    expect(res.body.ports.backend).toBe(3000);
    expect(res.body.ports.frontend).toBe(5173);
    expect(res.body.ports.database).toBe(5433);
    expect(res.body.ticket).toBeDefined();

    // Check disk persistence
    const saved = registry.getProject('TestApp');
    expect(saved).toBeDefined();
    expect(saved?.components['backend::node-ts']).toBe(3000);
    expect(saved?.components['frontend::vite']).toBe(5173);
    expect(saved?.components['database::postgres']).toBe(5433);
  });

  test('self-registers GS-Orchestrator assigning fixed ports 10000 for backend and frontend', async () => {
    const payload = {
      projectName: SELF_PROJECT_NAME,
      path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
      serviceTypes: { backend: 'node-ts', frontend: 'angular' },
    };

    const res = await request(app).post('/orch/project/register').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.ports.backend).toBe(10000);
    expect(res.body.ports.frontend).toBe(10000);
    expect(res.body.components['backend::node-ts']).toBe(10000);
    expect(res.body.components['frontend::angular']).toBe(10000);
  });

  test('idempotency: returning existing registration for already registered project', async () => {
    const payload = {
      projectName: 'IdempotentApp',
      path: '/tmp/idempotent',
      serviceTypes: { backend: 'node-ts' },
    };

    const first = await request(app).post('/orch/project/register').send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post('/orch/project/register').send(payload);
    expect(second.status).toBe(200);
    expect(second.body.ports.backend).toBe(first.body.ports.backend);
  });
});
