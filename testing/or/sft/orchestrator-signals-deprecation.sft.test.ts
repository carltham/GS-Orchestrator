import request from 'supertest';
import { app } from '../../../GS-Orchestrator/src/server';

describe('GS-Orchestrator - Signals Route Deprecation Check (Top-Down TDD)', () => {
  test('GET /api/signals/:projectName should return 404 Not Found', async () => {
    const res = await request(app).get('/api/signals/testApp');
    expect(res.status).toBe(404);
  });

  test('POST /api/signals/:projectName/ack should return 404 Not Found', async () => {
    const res = await request(app).post('/api/signals/testApp/ack');
    expect(res.status).toBe(404);
  });
});
