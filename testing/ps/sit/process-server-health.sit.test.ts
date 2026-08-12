describe('Process Server (:9999) - Health SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('GET /health returns status ok and port 9999', async () => {
    const response = await fetch(`${PROCESS_SERVER_URL}/health`);
    expect(response.status).toBe(200);

    const body = await response.json() as any;
    expect(body.status).toBe('ok');
    expect(body.server).toBe('ProcessServer');
    expect(body.port).toBe(9999);
  });
});
