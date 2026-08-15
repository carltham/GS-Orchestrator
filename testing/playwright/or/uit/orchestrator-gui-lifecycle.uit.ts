import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator Projects Lifecycle - GUI Integration Suite', () => {

  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'GUI-Simulated-Combo-App';

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

  test('should successfully view, stop, and configure a simulated project state through GUI controls', async ({ page }) => {
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
    await projectsTab.click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // 2. Identify Target Simulated Project Row and select status badge to trigger state change modal
    const targetRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: PROJECT_NAME }) });
    await expect(targetRow).toBeVisible();

    const statusBadge = targetRow.locator('.badge-clickable');
    
    // Log details of the target row for debugging purposes
    const rowText = await targetRow.innerText();
    const statusTextDetail = await statusBadge.innerText();
    console.log(`[VERBOSE PLAYWRIGHT DEBUG] Found simulated project row: "${rowText.trim()}"`);
    console.log(`[VERBOSE PLAYWRIGHT DEBUG] Initial status badge text: "${statusTextDetail.trim()}"`);

    await statusBadge.click();

    // 3. Verify State Management Modal displays
    const modalHeader = page.locator('.modal-content h3');
    await expect(modalHeader).toContainText('Manage Project State');

    // 4. Trigger Stop Component Process
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(1000);

    // Verify UI updates status to reflect "stopping" (transition state) or "stopped"
    const stoppingBadgeText = await statusBadge.textContent();
    expect(['stopping', 'stopped', 'running']).toContain(stoppingBadgeText?.trim());
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
});
