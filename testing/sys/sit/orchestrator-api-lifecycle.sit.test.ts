describe('GS-Orchestrator Lifecycle - API Integration Suite (Jest SIT)', () => {

  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'GS-Orchestrator';

  test('should successfully register, stop, and restart orchestrator via API', async () => {
    // 1. Initial Self-Registration Verification
    const registerRes = await fetch(`${ORCHESTRATOR_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: PROJECT_NAME,
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect(registerRes.status).toBe(201);
    const registerBody = await registerRes.json() as any;
    expect(registerBody.ports.backend).toBe(10000);

    // 2. Queue Stop Signal through ProcessServer
    const stopRes = await fetch(`${ORCHESTRATOR_URL}/api/register/${PROJECT_NAME}`, {
      method: 'DELETE'
    });
    expect(stopRes.status).toBe(200);
    const stopBody = await stopRes.json() as any;
    expect(stopBody.status).toBe('stopping');

    // 3. Peek process signal on ProcessServer (:9999) to confirm stop signal queued
    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/api/process/signals?projectName=${PROJECT_NAME}`);
    expect(signalsRes.status).toBe(200);
    const signalsBody = await signalsRes.json() as any;
    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();

    // 4. Simulate Client confirming stopped status in Orchestrator registry
    const stoppedConfirmRes = await fetch(`${ORCHESTRATOR_URL}/api/register/${PROJECT_NAME}/stopped`, {
      method: 'POST'
    });
    expect(stoppedConfirmRes.status).toBe(200);
    const confirmBody = await stoppedConfirmRes.json() as any;
    expect(confirmBody.status).toBe('stopped');

    // 5. Reregister GS-Orchestrator to trigger startup state
    const reregisterRes = await fetch(`${ORCHESTRATOR_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: PROJECT_NAME,
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect(reregisterRes.status).toBe(200);
    const reregisterBody = await reregisterRes.json() as any;
    expect(reregisterBody.ports.backend).toBe(10000);
  });
});
