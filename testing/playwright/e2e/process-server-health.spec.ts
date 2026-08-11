import { test, expect } from '@playwright/test';

test.describe('ProcessServer (:9999) - Health Suite', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('GET /health returns status ok and port 9999', async ({ request }) => {
    const response = await request.get(`${PROCESS_SERVER_URL}/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.server).toBe('ProcessServer');
    expect(body.port).toBe(9999);
  });
});
