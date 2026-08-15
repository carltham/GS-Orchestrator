describe('Process Server (:9999) - API Controls SIT', () => {
  const PROCESS_SERVER_URL = 'http://localhost:9999';

  test('POST /ps/process/signals forbids STOP signal for protected GS-Orchestrator', async () => {
    await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=GS-Orchestrator`);

    const shutdownRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject: 'GS-Orchestrator',
        action: 'STOP'
      })
    });
    expect(shutdownRes.status).toBe(403);

    const body = await shutdownRes.json() as any;
    expect(body.error).toContain('Cannot stop or unregister the main Orchestrator service');

    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=GS-Orchestrator&consume=false`);
    expect(signalsRes.status).toBe(200);

    const signalsBody = await signalsRes.json() as any;
    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeUndefined();
  });
});
