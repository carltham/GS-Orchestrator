import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { app } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator Server SFT - Health Check Endpoints', () => {
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

  test('GET /health returns status 200 and healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.port).toBe(10000);
  });

  test('GET /api/health returns status 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
