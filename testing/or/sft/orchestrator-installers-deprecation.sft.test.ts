import request from 'supertest';
import { app } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator - Installer Route Deprecation Check (Top-Down TDD)', () => {
  test('GET /install.sh should return 404 Not Found', async () => {
    const res = await request(app).get('/install.sh');
    expect(res.status).toBe(404);
  });

  test('GET /install.js should return 404 Not Found', async () => {
    const res = await request(app).get('/install.js');
    expect(res.status).toBe(404);
  });
});
