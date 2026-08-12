import request from 'supertest';
import { app } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator - Signals Route Deprecation Check (Top-Down TDD)', () => {
  test('GET /orch/project/signals/:projectName should return 404 Not Found', async () => {
    const res = await request(app).get('/orch/project/signals/testApp');
    expect(res.status).toBe(404);
  });

  test('POST /orch/project/signals/:projectName/ack should return 404 Not Found', async () => {
    const res = await request(app).post('/orch/project/signals/testApp/ack');
    expect(res.status).toBe(404);
  });
});
