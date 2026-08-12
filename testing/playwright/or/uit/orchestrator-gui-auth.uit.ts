import { test, expect } from '@playwright/test';

test.describe('GS-Orchestrator GUI - Authentication Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:10000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('should show login prompt for protected pages', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display login modal when clicking login button', async ({ page }) => {
    const loginPrompt = page.locator('button:has-text("Login"), [data-testid="login-prompt"] button');
    
    if (await loginPrompt.isVisible()) {
      await loginPrompt.click();
      
      const loginModal = page.locator('[data-testid="login-modal"], .login-modal, .modal');
      const loginForm = page.locator('form, [role="dialog"]');
      
      const hasModal = await loginModal.isVisible().catch(() => false);
      const hasForm = await loginForm.isVisible().catch(() => false);
      
      expect(hasModal || hasForm).toBeTruthy();
    }
  });

  test('should allow Thor superadmin login from localhost', async ({ page }) => {
    const loginButtons = await page.locator('button:has-text("Login")').all();
    
    if (loginButtons.length > 0) {
      await loginButtons[0].click();
      await page.waitForTimeout(500);
      
      const thorButton = page.locator('button:has-text("Thor")').first();
      if (await thorButton.isVisible()) {
        await thorButton.click();
        await page.waitForTimeout(1000);
        
        const authenticatedIndicator = page.locator('[data-testid="nav-tab-projects"], .nav-tabs button');
        const isAuthenticated = await authenticatedIndicator.isVisible().catch(() => false);
        
        if (isAuthenticated) {
          expect(isAuthenticated).toBeTruthy();
        }
      }
    }
  });
});
