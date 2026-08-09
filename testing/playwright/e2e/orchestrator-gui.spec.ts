import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator GUI - Top Down E2E Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display Application Header with Health Status & Script Downloads', async ({ page }) => {
    // Header & Title
    await expect(page.locator('header h1')).toContainText('GS-Orchestrator Control Center');

    // System Health badge
    const healthBadge = page.locator('[data-testid="system-health-badge"]');
    await expect(healthBadge).toBeVisible();
    await expect(healthBadge).toContainText(/Healthy|Online|OK/i);

    // Installer download links
    const shLink = page.locator('a[href*="/install.sh"]');
    const jsLink = page.locator('a[href*="/install.js"]');
    await expect(shLink).toBeVisible();
    await expect(jsLink).toBeVisible();
  });

  test('should display Home page with overview cards and description', async ({ page }) => {
    await expect(page.locator('[data-testid="page-home"]')).toBeVisible();
    await expect(page.locator('.hero-title')).toContainText('Welcome to GS-Orchestrator');

    // Total Registered Count Card
    const projectCountCard = page.locator('[data-testid="registered-count-card"]');
    await expect(projectCountCard).toBeVisible();

    // Orchestrator Port Card
    const portCard = page.locator('[data-testid="orchestrator-port-card"]');
    await expect(portCard).toBeVisible();
    await expect(portCard).toContainText('9000');
  });

  test('should display Registered Projects Table on Projects page', async ({ page }) => {
    await page.click('[data-testid="nav-tab-projects"]');
    await expect(page.locator('[data-testid="page-projects"]')).toBeVisible();

    const table = page.locator('[data-testid="registered-projects-table"]');
    await expect(table).toBeVisible();

    // Check table headers
    await expect(table.locator('th')).toHaveText([
      'Project Name',
      'Path',
      'Status',
      'Components & Allocated Ports',
      'Ticket',
      'Registered At'
    ]);
  });

  test('should allow registering a new project via Register New Project page', async ({ page }) => {
    await page.click('[data-testid="nav-tab-register"]');
    await expect(page.locator('[data-testid="page-register"]')).toBeVisible();

    const form = page.locator('[data-testid="registration-form"]');
    await expect(form).toBeVisible();

    const uniqueName = `TestProjectUI_${Date.now()}`;

    // Fill form inputs
    await page.fill('[data-testid="input-project-name"]', uniqueName);
    await page.fill('[data-testid="input-project-path"]', `/mnt/DATA/Projects/${uniqueName}`);
    await page.selectOption('[data-testid="select-backend-type"]', 'node-ts');
    await page.selectOption('[data-testid="select-frontend-type"]', 'angular');

    // Submit registration
    await page.click('[data-testid="btn-register-submit"]');

    // Verify confirmation message
    const alert = page.locator('[data-testid="registration-alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });
    await expect(alert).toContainText(/registered successfully/i);

    // Switch to Projects tab and verify row added to table
    await page.click('[data-testid="nav-tab-projects"]');
    const newRow = page.locator('[data-testid="registered-projects-table"] tr', { hasText: uniqueName });
    await expect(newRow).toBeVisible();
  });

  test('should display Unregistered Running Servers on Detected Servers page', async ({ page }) => {
    await page.click('[data-testid="nav-tab-unregistered"]');
    await expect(page.locator('[data-testid="page-unregistered"]')).toBeVisible();

    const section = page.locator('[data-testid="unregistered-servers-section"]');
    await expect(section).toBeVisible();

    // Check panel title
    await expect(section.locator('h2')).toContainText('Detected Unregistered Running Servers');

    // Check servers table or empty state notice
    const serverList = page.locator('[data-testid="unregistered-servers-list"]');
    await expect(serverList).toBeVisible();
  });

  test('should simulate sending health reports on Health Simulator page', async ({ page }) => {
    await page.click('[data-testid="nav-tab-health"]');
    await expect(page.locator('[data-testid="page-health"]')).toBeVisible();

    const section = page.locator('[data-testid="health-simulator-section"]');
    await expect(section).toBeVisible();

    await page.fill('[data-testid="input-health-project-name"]', 'GS-Orchestrator');
    await page.selectOption('[data-testid="select-health-status"]', 'ok');
    await page.fill('[data-testid="input-health-uptime"]', '3600');

    await page.click('[data-testid="btn-send-health"]');

    const resultAlert = page.locator('[data-testid="health-report-alert"]');
    await expect(resultAlert).toBeVisible();
    await expect(resultAlert).toContainText(/Health report received/i);
  });

  test('should allow unregistering a project from Registered Projects page', async ({ page }) => {
    // First, register a test project
    await page.click('[data-testid="nav-tab-register"]');
    await expect(page.locator('[data-testid="page-register"]')).toBeVisible();

    const uniqueName = `UnregTest_${Date.now()}`;

    // Fill and submit registration form
    await page.fill('[data-testid="input-project-name"]', uniqueName);
    await page.fill('[data-testid="input-project-path"]', `/mnt/DATA/Projects/${uniqueName}`);
    await page.selectOption('[data-testid="select-backend-type"]', 'node-ts');
    await page.selectOption('[data-testid="select-frontend-type"]', 'angular');
    await page.click('[data-testid="btn-register-submit"]');

    // Wait for success alert
    const alert = page.locator('[data-testid="registration-alert"]');
    await expect(alert).toBeVisible({ timeout: 10000 });

    // Dismiss any alert dialogs
    page.on('dialog', dialog => {
      dialog.accept();
    });

    // Navigate to Projects page
    await page.click('[data-testid="nav-tab-projects"]');
    const projectRow = page.locator('[data-testid="registered-projects-table"] tr', { hasText: uniqueName });
    await expect(projectRow).toBeVisible({ timeout: 5000 });

    // Find and click status badge to open state modal
    const statusBadge = projectRow.locator('span.badge-clickable');
    await expect(statusBadge).toBeVisible();
    await statusBadge.click();

    // Wait for modal to appear and click Stop button
    const stopButton = page.locator('button:has-text("🛑 Stop Project")');
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    // Wait for dialogs to be handled and request to complete
    await page.waitForTimeout(3000);

    // Reload to see updated state
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify row is no longer in the table
    const deletedRow = page.locator('[data-testid="registered-projects-table"] tr', { hasText: uniqueName });
    await expect(deletedRow).not.toBeVisible({ timeout: 5000 });
  });

});
