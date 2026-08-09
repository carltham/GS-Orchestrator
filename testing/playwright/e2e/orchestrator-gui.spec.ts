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

  test('should display System Overview Statistics Cards', async ({ page }) => {
    // Total Registered Count Card
    const projectCountCard = page.locator('[data-testid="registered-count-card"]');
    await expect(projectCountCard).toBeVisible();

    // Orchestrator Port Card
    const portCard = page.locator('[data-testid="orchestrator-port-card"]');
    await expect(portCard).toBeVisible();
    await expect(portCard).toContainText('9000');
  });

  test('should display Registered Projects Table & details', async ({ page }) => {
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

  test('should allow registering a new project via Registration Form', async ({ page }) => {
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

    // Verify confirmation message / new project appears in table
    const alert = page.locator('[data-testid="registration-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/registered successfully/i);

    // Verify row added to table
    const newRow = page.locator('[data-testid="registered-projects-table"] tr', { hasText: uniqueName });
    await expect(newRow).toBeVisible();
  });

  test('should display Unregistered Running Servers Panel', async ({ page }) => {
    const section = page.locator('[data-testid="unregistered-servers-section"]');
    await expect(section).toBeVisible();

    // Check panel title
    await expect(section.locator('h2')).toContainText('Detected Unregistered Running Servers');

    // Check servers table or empty state notice
    const serverList = page.locator('[data-testid="unregistered-servers-list"]');
    await expect(serverList).toBeVisible();
  });

  test('should simulate sending health reports via Health Simulator Form', async ({ page }) => {
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

});
