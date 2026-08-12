describe('Process Server (:9999) - API Controls SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('POST /ps/process/signals queues generic STOP signal for GS-Orchestrator', async () => {
    const shutdownRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject: 'GS-Orchestrator',
        action: 'STOP'
      })
    });
    expect(shutdownRes.status).toBe(201);

    const body = await shutdownRes.json() as any;
    expect(body.status).toBe('queued');
    expect(body.signal.targetProject).toBe('GS-Orchestrator');
    expect(body.signal.action).toBe('STOP');

    // Poll signal queue for GS-Orchestrator
    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=GS-Orchestrator&consume=false`);
    expect(signalsRes.status).toBe(200);

    const signalsBody = await signalsRes.json() as any;
    expect(signalsBody.signals.length).toBeGreaterThan(0);

    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();
  });
});
