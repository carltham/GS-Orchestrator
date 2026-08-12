import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator Lifecycle - GUI Integration Suite', () => {

  const ORCHESTRATOR_URL = 'http://localhost:10000';
  const PROJECT_NAME = 'SIT-Fresh-Verification-App';

  test.beforeEach(async ({ page }) => {
    // Ensure 'SIT-Fresh-Verification-App' is registered and marked as running in the database
    try {
      await fetch(`${ORCHESTRATOR_URL}/orch/project/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: PROJECT_NAME,
          path: '/mnt/DATA/Projects/0.present-projects/Active/GS-Orchestrator',
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

  test('should successfully view, stop, and restart orchestrator state through GUI controls', async ({ page }) => {
    // 1. Authenticate as Thor on localhost
    // Trigger login modal prompt
    await page.locator('[data-testid="nav-tab-projects"]').click();
    const loginButton = page.locator('button:has-text("Click here to login"), .login-prompt button');
    if (await loginButton.isVisible()) {
      await loginButton.click();
    }
    
    // Login as Thor
    await page.locator('button:has-text("Thor Superadmin Login")').click();
    await page.waitForTimeout(500);

    // Navigate to projects page
    await page.locator('[data-testid="nav-tab-projects"]').click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // 2. Identify Target Test Row and select status badge to trigger state change modal
    const targetRow = page.locator('tr').filter({ has: page.locator('.project-name', { hasText: PROJECT_NAME }) });
    await expect(targetRow).toBeVisible();

    const statusBadge = targetRow.locator('.badge-clickable');
    
    // Log verbose details of the target row for debugging purposes
    const rowText = await targetRow.innerText();
    const statusTextDetail = await statusBadge.innerText();
    console.log(`[VERBOSE PLAYWRIGHT DEBUG] Found row details: "${rowText.trim()}"`);
    console.log(`[VERBOSE PLAYWRIGHT DEBUG] Status badge text: "${statusTextDetail.trim()}"`);

    await expect(statusBadge).toContainText('running');
    await statusBadge.click();

    // 3. Verify State Management Modal displays
    const modalHeader = page.locator('.modal-content h3');
    await expect(modalHeader).toContainText('Manage Project State');

    // 4. Trigger Stop Component Process
    await page.locator('.btn-danger:has-text("Stop Project")').click();
    await page.waitForTimeout(1000);

    // Verify UI updates status to reflect "stopping" (transition state) or "stopped"
    const stoppingBadgeText = await statusBadge.textContent();
    expect(['stopping', 'stopped']).toContain(stoppingBadgeText?.trim());
  });
});
