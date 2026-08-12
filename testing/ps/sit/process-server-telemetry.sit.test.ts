describe('Process Server (:9999) - Telemetry SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('POST /ps/process/heartbeat & GET /ps/process/heartbeats tracks active telemetry', async () => {
    const heartbeat = {
      projectName: 'TestService',
      status: 'RUNNING',
      pid: 12345
    };

    // Send Heartbeat
    const postRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeat)
    });
    expect(postRes.status).toBe(200);

    // Get Active Heartbeats
    const getRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/heartbeats`);
    expect(getRes.status).toBe(200);

    const body = await getRes.json() as any;
    expect(body.processes).toBeDefined();

    const matched = body.processes.find((p: any) => p.projectName === 'TestService');
    expect(matched).toBeDefined();
    expect(matched.status).toBe('RUNNING');
    expect(matched.pid).toBe(12345);
  });
});
