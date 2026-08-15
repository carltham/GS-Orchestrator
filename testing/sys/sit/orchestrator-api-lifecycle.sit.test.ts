import { verifyStateChange } from '../../src/StateChangeTestTool';

describe('GS-Orchestrator Lifecycle - API Integration Suite (Jest SIT)', () => {

  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'SIT-Fresh-Verification-App';

  async function getProjectStatus(projectName: string): Promise<string | undefined> {
    const projectRes = await fetch(`${PROCESS_SERVER_URL}/ps/project/${projectName}`);
    if (projectRes.status === 404) return undefined;
    expect(projectRes.status).toBe(200);
    return ((await projectRes.json()) as any).status;
  }

  test('should successfully register, stop, and restart orchestrator via API', async () => {
    // 1. Initial Self-Registration Verification
    const registerRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
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
    expect(registerBody.ports.backend).toBeGreaterThan(0);

    // 2. Queue Stop Signal through ProcessServer
    await verifyStateChange({
      validatePreState: async () => {
        expect(await getProjectStatus(PROJECT_NAME)).toBe('running');
      },
      executeStateChange: () => fetch(`${ORCHESTRATOR_URL}/orch/project/${PROJECT_NAME}/stop`, {
        method: 'POST'
      }),
      validatePostState: async (response) => {
        expect(response.status).toBe(200);
        expect((await response.json() as any).status).toBe('stopping');
        expect(await getProjectStatus(PROJECT_NAME)).toBe('stopping');
      }
    });

    // 3. Peek process signal on ProcessServer (:9999) to confirm stop signal queued
    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=${PROJECT_NAME}&consume=false`);
    expect(signalsRes.status).toBe(200);
    const signalsBody = await signalsRes.json() as any;
    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();

    // 4. Simulate Client confirming stopped status in Orchestrator registry
    await verifyStateChange({
      validatePreState: async () => {
        expect(await getProjectStatus(PROJECT_NAME)).toBe('stopping');
      },
      executeStateChange: () => fetch(`${ORCHESTRATOR_URL}/orch/reporting/project/${PROJECT_NAME}/is-stopped`, {
        method: 'POST'
      }),
      validatePostState: async (response) => {
        expect(response.status).toBe(200);
        expect((await response.json() as any).status).toBe('stopped');
        expect(await getProjectStatus(PROJECT_NAME)).toBe('stopped');
      }
    });

    // 5. Restart the project and verify the persisted transition state
    await verifyStateChange({
      validatePreState: async () => {
        expect(await getProjectStatus(PROJECT_NAME)).toBe('stopped');
      },
      executeStateChange: () => fetch(`${ORCHESTRATOR_URL}/orch/project/${PROJECT_NAME}/restart`, {
        method: 'POST'
      }),
      validatePostState: async (response) => {
        expect(response.status).toBe(200);
        expect((await response.json() as any).status).toBe('starting');
        expect(await getProjectStatus(PROJECT_NAME)).toBe('starting');
      }
    });
  });

  test('should disallow stopping or unregistering the GS-Orchestrator core service via API', async () => {
    // 1. Ensure GS-Orchestrator is registered
    const registerRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'GS-Orchestrator',
        path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect([200, 201]).toContain(registerRes.status);

    // 2. Attempt to stop/unregister GS-Orchestrator via DELETE endpoint
    const stopRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/GS-Orchestrator`, {
      method: 'DELETE'
    });
    expect(stopRes.status).toBe(400);
    const stopBody = await stopRes.json() as any;
    expect(stopBody.error).toContain('Cannot stop or unregister the main Orchestrator service "GS-Orchestrator"');

    // 3. Attempt to report GS-Orchestrator as stopped via is-stopped endpoint
    const stoppedConfirmRes = await fetch(`${ORCHESTRATOR_URL}/orch/reporting/project/GS-Orchestrator/is-stopped`, {
      method: 'POST'
    });
    expect(stoppedConfirmRes.status).toBe(400);
    const confirmBody = await stoppedConfirmRes.json() as any;
    expect(confirmBody.error).toContain('permanently active and cannot be set to stopped');

    // 4. Verify GS-Orchestrator remains in running status in the registry
    const registryRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/registry`);
    expect(registryRes.status).toBe(200);
    const registryData = await registryRes.json() as any;
    expect(registryData.projects['GS-Orchestrator']).toBeDefined();
    expect(registryData.projects['GS-Orchestrator'].status).toBe('running');
  });
});
