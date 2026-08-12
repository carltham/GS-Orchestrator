import { test, expect } from '@playwright/test';

test.describe('ProcessServer (:9999) - Telemetry Suite', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('POST /api/process/heartbeat & GET /api/process/heartbeats tracks active telemetry', async ({ request }) => {
    const heartbeat = {
      projectName: 'TestService',
      status: 'RUNNING',
      pid: 12345
    };

    // Send Heartbeat
    const postRes = await request.post(`${PROCESS_SERVER_URL}/api/process/heartbeat`, {
      data: heartbeat
    });
    expect(postRes.status()).toBe(200);

    // Get Active Heartbeats
    const getRes = await request.get(`${PROCESS_SERVER_URL}/api/process/heartbeats`);
    expect(getRes.status()).toBe(200);

    const body = await getRes.json();
    expect(body.processes).toBeDefined();

    const matched = body.processes.find((p: any) => p.projectName === 'TestService');
    expect(matched).toBeDefined();
    expect(matched.status).toBe('RUNNING');
    expect(matched.pid).toBe(12345);
  });
});
