import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator Server SFT - Registry Metrics', () => {
  const distDir = path.join(__dirname, '..', '..', '..', 'GS-Orchestrator', 'dist');
  const registryPath = path.join(distDir, 'registry.json');
  const unregisteredPath = path.join(distDir, 'unregistered-servers.json');

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

  test('returns 0 when no projects are registered', async () => {
    const res = await request(app).get('/api/count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(0);
  });

  test('returns accurate count after project registration', async () => {
    await request(app).post('/api/register').send({
      projectName: 'AppOne',
      path: '/tmp/appone',
      serviceTypes: { backend: 'node-ts' },
    });

    await request(app).post('/api/register').send({
      projectName: 'AppTwo',
      path: '/tmp/apptwo',
      serviceTypes: { backend: 'node-ts' },
    });

    const res = await request(app).get('/api/count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
  });
});
