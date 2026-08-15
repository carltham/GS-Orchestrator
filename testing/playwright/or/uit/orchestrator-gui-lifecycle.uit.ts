import { test, expect } from '@playwright/test';
import { createServer, Server } from 'node:net';
import { verifyStateChange } from '../../../src/StateChangeTestTool';

test.describe('GS-Orchestrator Projects Lifecycle - GUI Integration Suite', () => {

  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROCESS_SERVER_URL = 'http://localhost:9999';
  const PROJECT_NAME = 'GUI-Simulated-Combo-App';
  const runningServers = new Map<number, Server>();

  async function startProjectPorts(ports: Record<string, number>): Promise<void> {
    for (const port of new Set(Object.values(ports))) {
      if (runningServers.has(port)) continue;

      const server = createServer((socket) => socket.end());
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
          runningServers.set(port, server);
          resolve();
        });
      });
    }
  }

  async function stopProjectPorts(): Promise<void> {
    await Promise.all(Array.from(runningServers.values()).map((server) => (
      new Promise<void>((resolve) => server.close(() => resolve()))
    )));
    runningServers.clear();
  }

  async function assureProjectRunning(projectName: string, projectPath: string): Promise<Record<string, number>> {
    const registerRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        path: projectPath,
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect([200, 201]).toContain(registerRes.status);
    const registration = await registerRes.json() as any;

    await startProjectPorts(registration.ports);

    const restartRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/${projectName}/restart`, {
      method: 'POST'
    });
    expect([200, 201]).toContain(restartRes.status);

    const runningRes = await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName,
        path: projectPath,
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    expect([200, 201]).toContain(runningRes.status);

    return registration.ports;
  }

  async function getProjectStatus(projectName: string): Promise<string | undefined> {
    const projectRes = await fetch(`${PROCESS_SERVER_URL}/ps/project/${projectName}`);
    if (projectRes.status === 404) return undefined;
    expect(projectRes.status).toBe(200);
    return ((await projectRes.json()) as any).status;
  }

  test.beforeEach(async ({ page }) => {
    // Ensure 'GUI-Simulated-Combo-App' and 'GS-Orchestrator' are registered in the database
    // Paths are kept separated from the GS-Orchestrator project root
    try {
      await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: 'GS-Orchestrator',
          path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
          serviceTypes: { backend: 'node-ts', frontend: 'angular' }
        })
      });

      await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: PROJECT_NAME,
          path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator/testing/temp-apps/dynamic-combo-app',
          serviceTypes: { backend: 'node-ts', frontend: 'angular' }
        })
      });
    } catch (err) {
      console.warn('⚠️ Could not complete pre-test registration setup:', err);
    }

    // Navigate to Orchestrator landing page
    await page.goto(ORCHESTRATOR_URL);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await stopProjectPorts();
  });

  test('should successfully view, stop, and configure a simulated project state through GUI controls', async ({ page }) => {
    const stateChangeProject = 'GUI-State-Change-App';
    await assureProjectRunning(
      stateChangeProject,
      '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator/testing/temp-apps/state-change-app'
    );

    // 1. Authenticate as Thor on localhost
    // Trigger login modal first
    const projectsTab = page.locator('[data-testid="nav-tab-projects"]');
    await projectsTab.click();
    await page.waitForTimeout(500);

    // If login overlay intercepts, trigger login
    const loginBtn = page.locator('button:has-text("Thor Superadmin Login")');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    } else {
      const loginPrompt = page.locator('button:has-text("Click here to login"), .login-prompt button');
      if (await loginPrompt.isVisible()) {
        await loginPrompt.click();
        await page.waitForSelector('button:has-text("Thor Superadmin Login")');
        await page.locator('button:has-text("Thor Superadmin Login")').click();
      }
    }
    await page.waitForTimeout(1000);

    // Ensure we are truly on the projects page displaying the registered projects table
    await page.reload();
    await projectsTab.click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // 2. Identify Target Simulated Project Row and select status badge to trigger state change modal
    const targetRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: stateChangeProject }) });
    await expect(targetRow).toBeVisible();

    const statusBadge = targetRow.locator('.badge-clickable');

    await verifyStateChange({
      validatePreState: async () => {
        await expect(statusBadge).toHaveText('running');
        expect(await getProjectStatus(stateChangeProject)).toBe('running');
      },
      executeStateChange: async () => {
        await statusBadge.click();
        await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');
        await page.locator('.btn-danger:has-text("Stop Project")').click();

        const confirmStop = page.locator('button:has-text("Confirm"), .dialog-btn-confirm');
        await expect(confirmStop).toBeVisible();
        await confirmStop.click();

        const okStop = page.locator('button:has-text("OK"), button:has-text("Close")');
        await expect(okStop).toBeVisible();
        await stopProjectPorts();
        await okStop.click();
      },
      validatePostState: async () => {
        await expect.poll(() => getProjectStatus(stateChangeProject)).toBe('stopped');
      }
    });
  });

  test('should disallow stopping the GS-Orchestrator core service from GUI', async ({ page }) => {
    // 1. Authenticate as Thor on localhost
    const projectsTab = page.locator('[data-testid="nav-tab-projects"]');
    await projectsTab.click();
    await page.waitForTimeout(500);

    const loginBtn = page.locator('button:has-text("Thor Superadmin Login")');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    } else {
      const loginPrompt = page.locator('button:has-text("Click here to login"), .login-prompt button');
      if (await loginPrompt.isVisible()) {
        await loginPrompt.click();
        await page.waitForSelector('button:has-text("Thor Superadmin Login")');
        await page.locator('button:has-text("Thor Superadmin Login")').click();
      }
    }
    await page.waitForTimeout(1000);

    await projectsTab.click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // 2. Identify GS-Orchestrator row in the registered projects table
    const orchRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: 'GS-Orchestrator' }) });
    await expect(orchRow).toBeVisible();

    const orchStatusBadge = orchRow.locator('.badge-clickable');
    await orchStatusBadge.click();

    // 3. Verify State Management Modal displays for GS-Orchestrator
    const modalHeader = page.locator('.modal-content h3');
    await expect(modalHeader).toContainText('Manage Project State');

    // 4. Attempt to trigger Stop on GS-Orchestrator
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(500);

    // Confirm the action in the confirmation dialog
    const confirmBtn = page.locator('button:has-text("Confirm"), .dialog-btn-confirm, button.btn-danger:has-text("Confirm")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(500);
    }

    // 5. Verify error dialog / message preventing Orchestrator from being stopped
    const dialogModal = page.locator('.dialog-modal, .modal-content, [role="dialog"], .dialog-overlay');
    await expect(dialogModal.first()).toBeVisible();

    const dialogText = await page.locator('body').innerText();
    expect(dialogText).toMatch(/Cannot stop or unregister the main Orchestrator service|Failed to stop project/);

    // Close any open alert dialog
    const okBtn = page.locator('button:has-text("OK"), button:has-text("Close")');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    }

    // 6. Verify GS-Orchestrator remains in "running" status
    const badgeTextAfter = await orchStatusBadge.textContent();
    expect(badgeTextAfter?.trim()).toBe('running');
  });

  test('should support full GUI lifecycle: start, stop, restart, stop again, and remove project', async ({ page }) => {
    const LIFECYCLE_PROJECT = 'GUI-Full-Lifecycle-App';
    const lifecyclePath = '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator/testing/temp-apps/lifecycle-app';

    // 1. Start the simulated project and verify a real running precondition
    const lifecyclePorts = await assureProjectRunning(LIFECYCLE_PROJECT, lifecyclePath);

    // 2. Authenticate as Thor and open projects page
    const projectsTab = page.locator('[data-testid="nav-tab-projects"]');
    await projectsTab.click();
    await page.waitForTimeout(500);

    const loginBtn = page.locator('button:has-text("Thor Superadmin Login")');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    } else {
      const loginPrompt = page.locator('button:has-text("Click here to login"), .login-prompt button');
      if (await loginPrompt.isVisible()) {
        await loginPrompt.click();
        await page.waitForSelector('button:has-text("Thor Superadmin Login")');
        await page.locator('button:has-text("Thor Superadmin Login")').click();
      }
    }
    await page.waitForTimeout(1000);

    await projectsTab.click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // Locate project row
    const projectRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: LIFECYCLE_PROJECT }) });
    await expect(projectRow).toBeVisible();
    const statusBadge = projectRow.locator('.badge-clickable');
    await expect(statusBadge).toHaveText('running');

    // --- STEP 1: STOP PROJECT (1st time) ---
    await statusBadge.click();
    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    
    // Confirm in dialog if prompt appears
    const confirmStop1 = page.locator('button:has-text("Confirm"), .dialog-btn-confirm');
    if (await confirmStop1.isVisible()) {
      await confirmStop1.click();
    }
    const okStop1 = page.locator('button:has-text("OK"), button:has-text("Close")');
    await expect(okStop1).toBeVisible();
    await stopProjectPorts();
    await okStop1.click();
    await page.waitForTimeout(1000);

    // Simulate client acknowledging stopped state
    await fetch(`${PROCESS_SERVER_URL}/ps/project/${LIFECYCLE_PROJECT}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'stopped' })
    });
    await page.reload();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // --- STEP 2: RESTART PROJECT (Start again) ---
    const stoppedRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: LIFECYCLE_PROJECT }) });
    await expect(stoppedRow).toBeVisible();
    await stoppedRow.locator('.badge-clickable').click();
    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');
    
    // In stopped state, both Restart and Remove Project are available
    await expect(page.locator('button:has-text("Remove Project")')).toBeVisible();
    await expect(page.locator('button:has-text("Restart Project")')).toBeVisible();

    // Click Restart Project
    await page.locator('button:has-text("Restart Project")').click();
    const confirmRestart = page.locator('button:has-text("Confirm"), .dialog-btn-confirm');
    if (await confirmRestart.isVisible()) {
      await confirmRestart.click();
    }
    const okRestart = page.locator('button:has-text("OK"), button:has-text("Close")');
    await expect(okRestart).toBeVisible();

    await startProjectPorts(lifecyclePorts);

    // Simulate client heartbeating / re-registering back to running
    await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: LIFECYCLE_PROJECT,
        path: lifecyclePath,
        serviceTypes: { backend: 'node-ts', frontend: 'angular' }
      })
    });
    await okRestart.click();
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // --- STEP 3: STOP PROJECT AGAIN (2nd time) ---
    const runningAgainRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: LIFECYCLE_PROJECT }) });
    await expect(runningAgainRow).toBeVisible();
    await runningAgainRow.locator('.badge-clickable').click();
    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    
    const confirmStop2 = page.locator('button:has-text("Confirm"), .dialog-btn-confirm');
    if (await confirmStop2.isVisible()) {
      await confirmStop2.click();
    }
    const okStop2 = page.locator('button:has-text("OK"), button:has-text("Close")');
    await expect(okStop2).toBeVisible();
    await stopProjectPorts();
    await okStop2.click();
    await page.waitForTimeout(1000);

    // Simulate client confirming stopped
    await fetch(`${PROCESS_SERVER_URL}/ps/project/${LIFECYCLE_PROJECT}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'stopped' })
    });
    await page.reload();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // --- STEP 4: REMOVE PROJECT FROM REGISTRY ---
    const finalStoppedRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: LIFECYCLE_PROJECT }) });
    await expect(finalStoppedRow).toBeVisible();
    await finalStoppedRow.locator('.badge-clickable').click();
    await expect(page.locator('.modal-content h3')).toContainText('Manage Project State');

    // Click Remove Project
    await page.locator('button:has-text("Remove Project")').click();
    const confirmRemove = page.locator('button:has-text("Confirm"), .dialog-btn-confirm');
    if (await confirmRemove.isVisible()) {
      await confirmRemove.click();
    }
    const okRemove = page.locator('button:has-text("OK"), button:has-text("Close")');
    if (await okRemove.isVisible()) {
      await okRemove.click();
    }
    await page.waitForTimeout(1000);

    // Verify project is completely removed from the registered projects table
    await page.reload();
    await page.waitForSelector('[data-testid="registered-projects-table"]');
    const removedRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: LIFECYCLE_PROJECT }) });
    await expect(removedRow).not.toBeVisible();
  });
});
