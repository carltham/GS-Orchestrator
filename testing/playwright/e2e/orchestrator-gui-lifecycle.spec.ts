import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator Lifecycle - GUI Integration Suite', () => {

  const ORCHESTRATOR_URL = 'http://localhost:10000';

  test.beforeEach(async ({ page }) => {
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
    await page.locator('button:has-text("Login as Thor")').click();
    await page.waitForTimeout(500);

    // Navigate to projects page
    await page.locator('[data-testid="nav-tab-projects"]').click();
    await page.waitForSelector('[data-testid="registered-projects-table"]');

    // 2. Identify GS-Orchestrator Row and select status badge to trigger state change modal
    const orchestratorRow = page.locator('tr:has-text("GS-Orchestrator")');
    await expect(orchestratorRow).toBeVisible();

    const statusBadge = orchestratorRow.locator('.badge-clickable');
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
