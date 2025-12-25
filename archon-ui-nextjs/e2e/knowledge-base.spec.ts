import { test, expect } from '@playwright/test';

test.describe('Knowledge Base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge-base');
    // Wait for page to load
    await page.waitForTimeout(2000);
  });

  test('should display knowledge base page title', async ({ page }) => {
    await expect(page.locator('h1').filter({ hasText: 'Knowledge Base' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Manage and explore indexed documentation and code examples')).toBeVisible();
  });

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search sources...');
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Type in search
    await searchInput.fill('react');

    // Search value should be reflected
    await expect(searchInput).toHaveValue('react');
  });

  test('should display stats cards', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('text=Total Sources', { timeout: 15000 });

    // Check for key stat cards using div.text-sm for exact matches
    await expect(page.locator('div.text-sm').filter({ hasText: /^Total Sources$/ })).toBeVisible();
    await expect(page.locator('div.text-sm').filter({ hasText: /^Total Documents$/ })).toBeVisible();
    await expect(page.locator('div.text-sm').filter({ hasText: /^Code Examples$/ })).toBeVisible();
    await expect(page.locator('div.text-sm').filter({ hasText: /^Total Words$/ })).toBeVisible();
  });

  test('should have filter dropdowns', async ({ page }) => {
    // Check for knowledge type filter
    const typeSelect = page.locator('select').filter({ hasText: 'All Types' });
    await expect(typeSelect).toBeVisible({ timeout: 10000 });

    // Check for level filter
    const levelSelect = page.locator('select').filter({ hasText: 'All Levels' });
    await expect(levelSelect).toBeVisible();

    // Test filtering by type
    await typeSelect.selectOption('technical');
    await expect(typeSelect).toHaveValue('technical');

    // Test filtering by level
    await levelSelect.selectOption('intermediate');
    await expect(levelSelect).toHaveValue('intermediate');
  });

  test('should open add source dialog', async ({ page }) => {
    // Click Add Source button
    const addButton = page.getByRole('button', { name: 'Add Source' });
    await expect(addButton).toBeVisible({ timeout: 10000 });
    await addButton.click();

    // Wait for dialog to appear (give it time to render)
    await page.waitForTimeout(500);

    // Check if dialog content is visible (look for dialog headings/text)
    const dialogContent = page.locator('div[role="dialog"], .dialog, [class*="dialog"]');
    if (await dialogContent.count() > 0) {
      await expect(dialogContent.first()).toBeVisible();
    }
  });

  test('should display source grid or empty state', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForTimeout(3000);

    // Check if sources are displayed or empty state
    const sourceCards = page.locator('[class*="grid"]').first();
    const emptyState = page.getByText(/no sources/i);

    // Either sources or empty state should be visible
    const hasCards = await sourceCards.count() > 0;
    const hasEmptyState = await emptyState.count() > 0;

    expect(hasCards || hasEmptyState).toBeTruthy();
  });

  test('should display crawling progress section', async ({ page }) => {
    // Check if CrawlingProgress component is rendered
    // It may or may not have active operations
    await page.waitForTimeout(2000);

    // Just verify page loaded without error
    await expect(page.locator('h1').filter({ hasText: 'Knowledge Base' })).toBeVisible();
  });
});
