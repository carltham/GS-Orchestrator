import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator GUI - Layout Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:10000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should display Application Header with Health Status & Script Downloads', async ({ page }) => {
    await expect(page.locator('header h1')).toContainText('GS-Orchestrator Control Center');

    const healthBadge = page.locator('[data-testid="system-health-badge"]');
    await expect(healthBadge).toBeVisible();
    
    const badgeText = await healthBadge.textContent();
    expect(badgeText).toBeTruthy();

    const shLink = page.locator('a[href*="/install.sh"]');
    const jsLink = page.locator('a[href*="/install.js"]');
    await expect(shLink).toBeVisible();
    await expect(jsLink).toBeVisible();
  });

  test('should display Home page with overview cards and description', async ({ page }) => {
    const homePage = page.locator('[data-testid="page-home"]');
    await expect(homePage).toBeVisible();
    
    await expect(page.locator('.hero-title')).toContainText('Welcome to GS-Orchestrator');

    const portCard = page.locator('[data-testid="orchestrator-port-card"]');
    await expect(portCard).toBeVisible();
    await expect(portCard).toContainText('10000');
  });
});
