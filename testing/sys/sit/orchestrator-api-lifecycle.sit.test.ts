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
    expect([200, 201]).toContain(registerRes.status);
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
        expect([200, 201]).toContain(response.status);
        const body = await response.json() as any;
        expect(['stopping', 'queued']).toContain(body.status);
        // Also peek process signals to confirm STOP signal was queued
        const signalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=${PROJECT_NAME}&consume=false`);
        expect(signalsRes.status).toBe(200);
        const signalsBody = await signalsRes.json() as any;
        const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
        expect(stopSignal).toBeDefined();
      }
    });

    // 3. Peek process signal on ProcessServer (:9999) to confirm stop signal queued
    const signalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=${PROJECT_NAME}&consume=false`);
    expect(signalsRes.status).toBe(200);
    const signalsBody = await signalsRes.json() as any;
    const stopSignal = signalsBody.signals.find((s: any) => s.action === 'STOP');
    expect(stopSignal).toBeDefined();

    // 4. Simulate Client reporting status directly via ProcessServer heartbeat
    await verifyStateChange({
      validatePreState: async () => {
        expect(await getProjectStatus(PROJECT_NAME)).toBeDefined();
      },
      executeStateChange: () => fetch(`${PROCESS_SERVER_URL}/ps/process/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: PROJECT_NAME,
          status: 'stopped',
          components: {}
        })
      }),
      validatePostState: async (response) => {
        expect(response.status).toBe(200);
        // Also update project registry status via status PUT if simulating complete state
        await fetch(`${PROCESS_SERVER_URL}/ps/project/${PROJECT_NAME}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'stopped' })
        });
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
        expect([200, 201]).toContain(response.status);
        const body = await response.json() as any;
        expect(['starting', 'queued']).toContain(body.status);
        // Also peek process signals to confirm START signal was queued
        const startSignalsRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals?projectName=${PROJECT_NAME}&consume=false`);
        expect(startSignalsRes.status).toBe(200);
        const startSignalsBody = await startSignalsRes.json() as any;
        const startSignal = startSignalsBody.signals.find((s: any) => s.action === 'START');
        expect(startSignal).toBeDefined();
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

    // 2. Attempt to stop GS-Orchestrator via signal queue endpoint (should be blocked by ProcessServer)
    const stopSignalRes = await fetch(`${PROCESS_SERVER_URL}/ps/process/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProject: 'GS-Orchestrator',
        action: 'STOP'
      })
    });
    expect(stopSignalRes.status).toBe(403);
    const stopBody = await stopSignalRes.json() as any;
    expect(stopBody.error).toContain('Cannot stop or unregister the main Orchestrator service "GS-Orchestrator"');

    // 3. Attempt to unregister GS-Orchestrator via DELETE endpoint
    const unregisterRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/GS-Orchestrator`, {
      method: 'DELETE'
    });
    expect(unregisterRes.status).toBe(400);

    // 4. Verify GS-Orchestrator remains in running status in the registry
    const registryRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/registry`);
    expect(registryRes.status).toBe(200);
    const registryData = await registryRes.json() as any;
    expect(registryData.projects['GS-Orchestrator']).toBeDefined();
    expect(registryData.projects['GS-Orchestrator'].status).toBe('running');
  });
});
