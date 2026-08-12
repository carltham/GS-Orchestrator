describe('Process Server (:9999) - API Controls SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('POST /api/orchestrator/shutdown queues STOP signal for GS-Orchestrator', async () => {
    const shutdownRes = await fetch(`${PROCESS_SERVER_URL}/api/orchestrator/shutdown`, {
      method: 'POST'
    });
    expect(shutdownRes.status).toBe(200);

    const body = await shutdownRes.json() as any;
    expect(body.status).toBe('shutdown_queued');
    expect(body.target).toBe('GS-Orchestrator');

    // Poll signal queue for GS-Orchestrator
    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/api/process/signals?projectName=GS-Orchestrator`);
    expect(signalsRes.status).toBe(200);

    const signalsBody = await signalsRes.json() as any;
    expect(signalsBody.signals.length).toBeGreaterThan(0);

    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();
  });
});
