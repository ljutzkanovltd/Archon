import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for stats to load
    await page.waitForTimeout(2000);
  });

  test('should display dashboard title', async ({ page }) => {
    // Look for h1 with "Dashboard" text
    await expect(page.locator('h1').filter({ hasText: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Welcome to Archon Knowledge Base & Task Management')).toBeVisible();
  });

  test('should display stats cards', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForSelector('text=Total Projects', { timeout: 15000 });

    // Check for key stat cards using exact text and role
    await expect(page.locator('p.text-sm').filter({ hasText: 'Total Projects' })).toBeVisible();
    await expect(page.locator('p.text-sm').filter({ hasText: 'Total Tasks' })).toBeVisible();
    await expect(page.locator('p.text-sm').filter({ hasText: 'Completion Rate' })).toBeVisible();
    await expect(page.locator('p.text-sm').filter({ hasText: 'My Tasks' }).first()).toBeVisible();
    await expect(page.locator('p.text-sm').filter({ hasText: 'Agent Tasks' })).toBeVisible();
  });

  test('should have working sidebar navigation', async ({ page }) => {
    // Check sidebar links exist
    const projectsLink = page.locator('a[href="/projects"]').first();

    await expect(projectsLink).toBeVisible({ timeout: 10000 });

    // Navigate to projects page
    await projectsLink.click();
    await page.waitForURL('/projects', { timeout: 10000 });
    await expect(page).toHaveURL('/projects');
  });

  test('should display quick actions', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=View Projects', { timeout: 15000 });

    // Check quick action links using h3 headings
    await expect(page.locator('h3').filter({ hasText: 'View Projects' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'My Tasks' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Documents' })).toBeVisible();
  });

  test('should display task breakdown charts', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Task Status Breakdown', { timeout: 15000 });

    // Check for breakdown sections using h2 headings
    await expect(page.locator('h2').filter({ hasText: 'Task Status Breakdown' })).toBeVisible();
    await expect(page.locator('h2').filter({ hasText: 'Task Assignment' })).toBeVisible();

    // Check for status labels using exact text in span elements
    await expect(page.locator('span').filter({ hasText: /^To Do$/ })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^In Progress$/ })).toBeVisible();
    await expect(page.locator('span').filter({ hasText: /^Completed$/ })).toBeVisible();
  });
});
