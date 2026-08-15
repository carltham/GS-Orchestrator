import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess } from 'child_process';
import {
  prepareSelectedProject,
  resetSimulatedAppWorkspace,
  spawnSimulatedClient,
  stopSimulatedClient
} from '../../../src/SimulatedAppHelper';

test.describe('GS-Orchestrator Projects Lifecycle - Simulator-Driven GUI Suite', () => {
  test.describe.configure({ mode: 'serial', timeout: 120000 });

  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const STATE_TRANSITION_TIMEOUT = 30000;
  const workspaceRoot = path.resolve(__dirname, '../../../../');
  const tempAppsDir = path.join(workspaceRoot, 'testing', 'temp-apps');

  let clientProcess: ChildProcess | undefined;
  let testAppDir = '';
  let currentProjectName = '';

  function createProjectName(baseName: string): string {
    return `${baseName}-${process.pid}-${Date.now()}`;
  }

  async function authenticateAsThor(page: any): Promise<void> {
    const projectsTab = page.locator('[data-testid="nav-tab-projects"]');
    await projectsTab.click();
    await page.waitForTimeout(1000);

    const loginBtn = page.locator('button:has-text("Thor Superadmin Login")');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    } else {
      const loginPrompt = page.locator('button:has-text("Click here to login"), .login-prompt button');
      if (await loginPrompt.isVisible()) {
        await loginPrompt.click();
        await page.waitForTimeout(1000);
        const thorOption = page.locator('button:has-text("Thor Superadmin Login")');
        await thorOption.waitFor({ state: 'visible' });
        await thorOption.click();
      }
    }
    await page.waitForTimeout(1500);
    await projectsTab.click();
    await page.waitForTimeout(1000);
    await page.waitForSelector('[data-testid="registered-projects-table"]');
  }

  async function getClientStatus(projectName: string): Promise<string | undefined> {
    try {
      const response = await fetch(`${PROCESS_SERVER_URL}/ps/process/heartbeats`);
      if (!response.ok) return undefined;
      const body = await response.json() as any;
      return body.processes?.find((p: any) => p.projectName === projectName)?.status;
    } catch {
      return undefined;
    }
  }

  async function getProjectStatus(projectName: string): Promise<string | undefined> {
    const response = await fetch(`${PROCESS_SERVER_URL}/ps/project/${encodeURIComponent(projectName)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) return undefined;
    return ((await response.json()) as any).status;
  }

  async function queueSignal(projectName: string, action: 'STOP' | 'DELETE'): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await fetch(`${PROCESS_SERVER_URL}/ps/process/signals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetProject: projectName, action })
        });
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    throw lastError;
  }

  async function getClientStatusWithRetry(projectName: string): Promise<string | undefined> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const status = await getClientStatus(projectName);
      if (status) return status;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return undefined;
  }

  async function waitForClientStatus(projectName: string, expected: string, timeout = 5000): Promise<boolean> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await getClientStatus(projectName) === expected) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return false;
  }

  async function confirmProjectSignal(
    page: any,
    confirmButton: any,
    projectName: string,
    endpoint: 'stop' | 'restart',
    action: 'STOP' | 'START'
  ): Promise<void> {
    const [response] = await Promise.all([
      page.waitForResponse((candidate: any) =>
        candidate.request().method() === 'POST'
        && new URL(candidate.url()).pathname === `/orch/project/${encodeURIComponent(projectName)}/${endpoint}`
      ),
      confirmButton.click()
    ]);

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      status: 'queued',
      signal: { targetProject: projectName, action }
    });
  }

  async function refreshRegistry(page: any): Promise<void> {
    await Promise.all([
      page.waitForResponse((response: any) =>
        response.url().includes('/orch/project/registry') && response.ok()
      ),
      page.locator('button:has-text("Refresh Data")').click()
    ]);
  }

  test.beforeEach(async ({ page }) => {
    if (!fs.existsSync(tempAppsDir)) {
      fs.mkdirSync(tempAppsDir, { recursive: true });
    }
    await page.goto(ORCHESTRATOR_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test.afterEach(async ({}, testInfo) => {
    const preserveArtifacts = testInfo.status !== testInfo.expectedStatus;
    try {
      let status = currentProjectName
        ? await getClientStatusWithRetry(currentProjectName)
        : undefined;
      if (currentProjectName && status === 'RUNNING') {
        const stopResponse = await queueSignal(currentProjectName, 'STOP');
        if (stopResponse.ok && await waitForClientStatus(currentProjectName, 'STOPPED', STATE_TRANSITION_TIMEOUT)) {
          status = 'STOPPED';
        }
      }
      if (currentProjectName && status === 'STOPPED') {
        const deleteResponse = await queueSignal(currentProjectName, 'DELETE');
        if (deleteResponse.ok) {
          await expect.poll(
            async () => getProjectStatus(currentProjectName),
            { timeout: STATE_TRANSITION_TIMEOUT }
          ).toBeUndefined();
        }
      }
    } finally {
      stopSimulatedClient(clientProcess);
      clientProcess = undefined;
      currentProjectName = '';
      if (testAppDir && !preserveArtifacts) {
        resetSimulatedAppWorkspace(testAppDir);
        fs.rmSync(testAppDir, { recursive: true, force: true });
      }
      testAppDir = '';
    }
  });

  test('should view simulated project running, stop it via GUI, and observe client telemetry transition', async ({ page }) => {
    const projectName = createProjectName('GUI-Sim-Lifecycle-App');
    currentProjectName = projectName;
    testAppDir = path.join(tempAppsDir, projectName);
    resetSimulatedAppWorkspace(testAppDir);
    prepareSelectedProject(workspaceRoot, tempAppsDir, testAppDir, {
      backend: true,
      frontend: true
    });

    // 1. Install & start real ProcessClient on the simulator
    clientProcess = spawnSimulatedClient(testAppDir);

    // Wait for the client to register and report RUNNING telemetry
    await expect.poll(async () => getClientStatus(projectName), { timeout: STATE_TRANSITION_TIMEOUT }).toBe('RUNNING');
    await page.waitForTimeout(1500);

    // 2. Open GUI and authenticate as Thor
    await authenticateAsThor(page);

    // 3. Locate simulator row in registry table
    const row = page.locator('tr').filter({
      has: page.locator('.project-name strong').getByText(projectName, { exact: true })
    });
    await expect(row).toBeVisible();
    const statusBadge = row.locator('.badge-clickable');
    await expect(statusBadge).toHaveText('running');

    // 4. Open State Management Modal
    await statusBadge.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');

    // 5. Trigger Stop Project in GUI
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(1000);

    // Confirm dialog (Angular dialog modal)
    const confirmBtn = page.locator('app-dialog-modal button.btn-primary', { hasText: 'Confirm' });
    await confirmBtn.waitFor({ state: 'visible' });
    await confirmProjectSignal(page, confirmBtn, projectName, 'stop', 'STOP');
    await page.waitForTimeout(1500);

    // Acknowledge alert notification
    const okBtn = page.locator('app-dialog-modal button.btn-primary', { hasText: 'OK' });
    await okBtn.waitFor({ state: 'visible' });
    await okBtn.click();
    await page.waitForTimeout(1000);

    // 6. Verify client processed STOP signal and reported STOPPED heartbeat
    await expect.poll(async () => getClientStatus(projectName), { timeout: STATE_TRANSITION_TIMEOUT }).toBe('STOPPED');
    await page.waitForTimeout(1000);

    // 7. Refresh GUI and verify status badge reflects stopped state
    await refreshRegistry(page);
    await expect(statusBadge).toHaveText('stopped', { timeout: STATE_TRANSITION_TIMEOUT });
  });

  test('should restart a stopped simulated project through GUI controls and observe client restart', async ({ page }) => {
    const projectName = createProjectName('GUI-Sim-Restart-App');
    currentProjectName = projectName;
    testAppDir = path.join(tempAppsDir, projectName);
    resetSimulatedAppWorkspace(testAppDir);
    prepareSelectedProject(workspaceRoot, tempAppsDir, testAppDir, {
      backend: true,
      database: true
    });

    // 1. Install & start real ProcessClient on the simulator
    clientProcess = spawnSimulatedClient(testAppDir);
    await expect.poll(async () => getClientStatus(projectName), { timeout: STATE_TRANSITION_TIMEOUT }).toBe('RUNNING');
    await page.waitForTimeout(1500);

    await authenticateAsThor(page);

    const row = page.locator('tr').filter({
      has: page.locator('.project-name strong').getByText(projectName, { exact: true })
    });
    await expect(row).toBeVisible();
    const statusBadge = row.locator('.badge-clickable');

    // Stop project first via GUI
    await statusBadge.click();
    await page.waitForTimeout(1000);
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(1000);

    const confirmStop = page.locator('app-dialog-modal button.btn-primary', { hasText: 'Confirm' });
    await confirmStop.waitFor({ state: 'visible' });
    await confirmProjectSignal(page, confirmStop, projectName, 'stop', 'STOP');
    await page.waitForTimeout(1500);

    const okStop = page.locator('app-dialog-modal button.btn-primary', { hasText: 'OK' });
    await okStop.waitFor({ state: 'visible' });
    await okStop.click();
    await page.waitForTimeout(1000);

    await expect.poll(async () => getClientStatus(projectName), { timeout: STATE_TRANSITION_TIMEOUT }).toBe('STOPPED');
    await refreshRegistry(page);
    await expect(statusBadge).toHaveText('stopped', { timeout: STATE_TRANSITION_TIMEOUT });

    // Restart project via GUI
    await statusBadge.click();
    await page.waitForTimeout(1000);
    await expect(page.locator('button:has-text("Restart Project")')).toBeVisible();
    await page.locator('button:has-text("Restart Project")').click();
    await page.waitForTimeout(1000);

    const confirmRestart = page.locator('app-dialog-modal button.btn-primary', { hasText: 'Confirm' });
    await confirmRestart.waitFor({ state: 'visible' });
    await confirmProjectSignal(page, confirmRestart, projectName, 'restart', 'START');
    await page.waitForTimeout(1500);

    const okRestart = page.locator('app-dialog-modal button.btn-primary', { hasText: 'OK' });
    await okRestart.waitFor({ state: 'visible' });
    await okRestart.click();
    await page.waitForTimeout(1000);

    // Verify client received START signal and resumed RUNNING
    await expect.poll(async () => getClientStatus(projectName), { timeout: STATE_TRANSITION_TIMEOUT }).toBe('RUNNING');
    await refreshRegistry(page);
    await expect(statusBadge).toHaveText('running', { timeout: STATE_TRANSITION_TIMEOUT });
  });

  test('should disallow stopping the GS-Orchestrator core service from GUI', async ({ page }) => {
    const registrationResponse = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: 'GS-Orchestrator',
        path: workspaceRoot,
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect(registrationResponse.ok).toBe(true);

    await authenticateAsThor(page);
    await refreshRegistry(page);

    // Locate GS-Orchestrator core row
    const orchRow = page.locator('tr').filter({
      has: page.locator('.project-name strong').getByText('GS-Orchestrator', { exact: true })
    });
    await expect(orchRow).toBeVisible();

    const orchStatusBadge = orchRow.locator('.badge-clickable');
    await orchStatusBadge.click();
    await page.waitForTimeout(1000);

    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(1000);

    // Verify Action Forbidden notification dialog is displayed immediately
    const errorDialog = page.locator('app-dialog-modal .modal-backdrop');
    await expect(errorDialog).toBeVisible();
    const dialogTitle = await errorDialog.locator('h3').innerText();
    expect(dialogTitle).toMatch(/Action Forbidden|Error/i);
    const dialogMessage = await errorDialog.locator('.dialog-message').innerText();
    expect(dialogMessage).toMatch(/Action forbidden|Cannot stop or unregister the main Orchestrator service/i);
    await page.waitForTimeout(1000);

    // Dismiss dialog
    const okBtn = errorDialog.locator('button.btn-primary', { hasText: 'OK' });
    await okBtn.click();
    await page.waitForTimeout(1000);

    // Verify GS-Orchestrator remains running
    expect(await orchStatusBadge.textContent()).toMatch(/running/);
  });
});
