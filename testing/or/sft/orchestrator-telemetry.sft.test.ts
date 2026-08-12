import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { app, registry } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator Server SFT - Health & Telemetry Reports', () => {
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

  test('rejects health report for unregistered project with 404', async () => {
    const res = await request(app).post('/orch/reporting/project/health').send({
      projectName: 'NonExistentProject',
      health: { status: 'ok' },
    });
    expect(res.status).toBe(404);
  });

  test('accepts health report for registered project and updates status', async () => {
    await request(app).post('/orch/project/register').send({
      projectName: 'HealthyApp',
      path: '/tmp/healthy',
      serviceTypes: { backend: 'node-ts' },
    });

    const res = await request(app).post('/orch/reporting/project/health').send({
      projectName: 'HealthyApp',
      health: {
        status: 'ok',
        backendStatus: true,
        frontendStatus: false,
        uptimeSeconds: 120,
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);

    const entry = registry.getProject('HealthyApp');
    expect(entry?.status).toBe('running');
  });
});
