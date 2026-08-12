import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator Lifecycle - API Integration Suite', () => {

  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'GS-Orchestrator';

  test('should successfully register, stop, and restart orchestrator via API', async ({ request }) => {
    // 1. Initial Self-Registration Verification
    const registerRes = await request.post(`${ORCHESTRATOR_URL}/api/register`, {
      data: {
        projectName: PROJECT_NAME,
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      }
    });
    expect(registerRes.status()).toBe(201);
    const registerBody = await registerRes.json();
    expect(registerBody.ports.backend).toBe(10000);

    // 2. Queue Stop Signal through ProcessServer
    const stopRes = await request.delete(`${ORCHESTRATOR_URL}/api/register/${PROJECT_NAME}`);
    expect(stopRes.status()).toBe(200);
    const stopBody = await stopRes.json();
    expect(stopBody.status).toBe('stopping');

    // 3. Peek process signal on ProcessServer (:9999) to confirm stop signal queued
    const signalsRes = await request.get(`${PROCESS_SERVER_URL}/api/process/signals?projectName=${PROJECT_NAME}`);
    expect(signalsRes.status()).toBe(200);
    const signalsBody = await signalsRes.json();
    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();

    // 4. Simulate Client confirming stopped status in Orchestrator registry
    const stoppedConfirmRes = await request.post(`${ORCHESTRATOR_URL}/api/register/${PROJECT_NAME}/stopped`);
    expect(stoppedConfirmRes.status()).toBe(200);
    const confirmBody = await stoppedConfirmRes.json();
    expect(confirmBody.status).toBe('stopped');

    // 5. Reregister GS-Orchestrator to trigger startup state
    const reregisterRes = await request.post(`${ORCHESTRATOR_URL}/api/register`, {
      data: {
        projectName: PROJECT_NAME,
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      }
    });
    expect(reregisterRes.status()).toBe(200);
    const reregisterBody = await reregisterRes.json();
    expect(reregisterBody.ports.backend).toBe(10000);
  });
});
