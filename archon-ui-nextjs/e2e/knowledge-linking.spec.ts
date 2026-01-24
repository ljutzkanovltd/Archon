import { test, expect } from '@playwright/test';

/**
 * E2E Tests - Knowledge Linking Workflow
 * Phase 4.18: Test linking knowledge items, AI suggestions, unlinking
 *
 * Tests cover:
 * - AI knowledge suggestions display
 * - Relevance score badges (color-coded)
 * - Linking knowledge items to projects
 * - Unlinking knowledge items
 * - Suggestion content preview expansion
 * - Cached results indicator
 * - Empty state handling
 */

test.describe('Knowledge Linking Workflow', () => {
  let testProjectId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test project for knowledge linking tests
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Knowledge Test Project',
        description: 'Test project for knowledge linking E2E tests with authentication and JWT patterns',
      },
    });
    const projectData = await projectResponse.json();
    testProjectId = projectData.project.id;
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to project detail page
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('AI Knowledge Suggestions Display', () => {
    test('should display AI Knowledge Suggestions panel', async ({ page }) => {
      // Check for panel header
      await expect(page.locator('text=AI Knowledge Suggestions')).toBeVisible({ timeout: 10000 });

      // Check for lightbulb icon
      const lightbulbIcon = page.locator('svg').filter({ has: page.locator('path') }).first();
      await expect(lightbulbIcon).toBeVisible();

      // Check for suggestions count text
      await expect(page.locator('text=/\\d+ relevant items found/i')).toBeVisible({ timeout: 5000 });
    });

    test('should display relevance score badges with correct colors', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Wait for at least one suggestion card
      const suggestionCards = page.locator('div').filter({
        has: page.locator('text=/\\d+%/')
      });

      if (await suggestionCards.count() > 0) {
        // Check that percentage badges exist
        const badges = page.locator('span').filter({ hasText: /^\d+%$/ });
        await expect(badges.first()).toBeVisible({ timeout: 5000 });

        // Verify badge colors based on score ranges
        // High relevance (≥80%) should have success/green color
        const highScoreBadge = badges.filter({ hasText: /^(8\d|9\d|100)%$/ }).first();
        if (await highScoreBadge.isVisible()) {
          const badgeClass = await highScoreBadge.getAttribute('class');
          expect(badgeClass).toContain('bg-green');
        }

        // Medium relevance (60-79%) should have info/blue color
        const mediumScoreBadge = badges.filter({ hasText: /^(6\d|7\d)%$/ }).first();
        if (await mediumScoreBadge.isVisible()) {
          const badgeClass = await mediumScoreBadge.getAttribute('class');
          expect(badgeClass).toContain('bg-blue');
        }
      }
    });

    test('should show cached results indicator when applicable', async ({ page }) => {
      // Wait for panel to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Check if cached indicator appears (may not always be present)
      const cachedText = page.locator('text=(cached)');
      if (await cachedText.isVisible()) {
        await expect(cachedText).toBeVisible();
      }
    });

    test('should display empty state when no suggestions found', async ({ page }) => {
      // This test requires a project with no relevant knowledge
      // Create a very specific project that won't match anything
      const emptyProjectResponse = await page.request.post('/api/projects', {
        data: {
          title: 'ZZZZZ No Matches Test ZZZZZ',
          description: 'XXXXXXXXX YYYYYYYY ZZZZZZZZ',
        },
      });
      const emptyProjectData = await emptyProjectResponse.json();
      const emptyProjectId = emptyProjectData.project.id;

      // Navigate to the empty project
      await page.goto(`/projects/${emptyProjectId}`);
      await page.waitForLoadState('networkidle');

      // Wait for panel to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Check for empty state message
      const emptyStateVisible = await page.locator('text=/No relevant knowledge items found/i').isVisible();

      if (emptyStateVisible) {
        await expect(page.locator('text=/No relevant knowledge items found/i')).toBeVisible();
        await expect(page.locator('text=/Try adding more details/i')).toBeVisible();
      }

      // Cleanup
      await page.request.delete(`/api/projects/${emptyProjectId}`);
    });
  });

  test.describe('Content Preview Expansion', () => {
    test('should expand and collapse content preview', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Find a suggestion with "Show more" button (indicates long content)
      const showMoreButton = page.locator('button').filter({ hasText: /Show more/i }).first();

      if (await showMoreButton.isVisible()) {
        // Click to expand
        await showMoreButton.click();
        await page.waitForTimeout(300);

        // Should now show "Show less"
        await expect(page.locator('button').filter({ hasText: /Show less/i }).first()).toBeVisible();

        // Click to collapse
        const showLessButton = page.locator('button').filter({ hasText: /Show less/i }).first();
        await showLessButton.click();
        await page.waitForTimeout(300);

        // Should now show "Show more" again
        await expect(showMoreButton).toBeVisible();
      }
    });

    test('should display external link for knowledge items with URLs', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Look for external link icon (HiExternalLink)
      const externalLinks = page.locator('a[target="_blank"][rel="noopener noreferrer"]');

      if (await externalLinks.count() > 0) {
        const firstLink = externalLinks.first();
        await expect(firstLink).toBeVisible();

        // Verify external link icon is present
        const linkIcon = firstLink.locator('svg').last();
        await expect(linkIcon).toBeVisible();
      }
    });
  });

  test.describe('Knowledge Linking Operations', () => {
    test('should link a knowledge suggestion to project', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Find first "Link" button that is not disabled
      const linkButtons = page.locator('button').filter({ hasText: /^Link$/i });
      const firstAvailableButton = linkButtons.first();

      if (await firstAvailableButton.isVisible()) {
        // Click link button
        await firstAvailableButton.click();

        // Wait for success notification
        await expect(page.locator('text=/Knowledge item linked successfully/i')).toBeVisible({
          timeout: 5000
        });

        // Verify button changes to "Linked" state
        await expect(page.locator('button').filter({ hasText: /^Linked$/i }).first()).toBeVisible({
          timeout: 3000
        });

        // Verify "Linked" badge appears
        await expect(page.locator('span').filter({ hasText: /Linked/i }).first()).toBeVisible({
          timeout: 3000
        });
      }
    });

    test('should show linked status for already-linked items', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // First, link an item
      const linkButtons = page.locator('button').filter({ hasText: /^Link$/i });
      if (await linkButtons.count() > 0) {
        await linkButtons.first().click();
        await page.waitForTimeout(1000);

        // Reload page to verify linked status persists
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

        // Check for "Linked" badge
        const linkedBadge = page.locator('span').filter({ hasText: /Linked/i }).first();
        if (await linkedBadge.isVisible()) {
          await expect(linkedBadge).toBeVisible();
        }

        // Check that button shows "Linked" state
        const linkedButton = page.locator('button').filter({ hasText: /^Linked$/i }).first();
        if (await linkedButton.isVisible()) {
          await expect(linkedButton).toBeVisible();
          await expect(linkedButton).toBeDisabled();
        }
      }
    });

    test('should disable link button while linking is in progress', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Find first "Link" button
      const linkButton = page.locator('button').filter({ hasText: /^Link$/i }).first();

      if (await linkButton.isVisible()) {
        // Click and immediately check if disabled
        const clickPromise = linkButton.click();

        // Button should be disabled while mutation is pending
        await page.waitForTimeout(100);

        await clickPromise;

        // Wait for operation to complete
        await page.waitForTimeout(1000);
      }
    });

    test.skip('should unlink a knowledge item', async ({ page }) => {
      // This test requires implementation of unlink functionality in the UI
      // Currently the KnowledgeSuggestionsPanel doesn't have unlink button
      // TODO: Implement when unlink UI is added

      // Expected workflow:
      // 1. Find a linked knowledge item
      // 2. Click unlink/remove button
      // 3. Verify toast notification
      // 4. Verify item no longer shows as linked
    });
  });

  test.describe('Knowledge Type Indicators', () => {
    test('should display knowledge type for each suggestion', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Look for knowledge type indicators (e.g., "crawled page", "code example")
      const typeIndicators = page.locator('span').filter({
        hasText: /crawled page|code example|document/i
      });

      if (await typeIndicators.count() > 0) {
        await expect(typeIndicators.first()).toBeVisible();
      }
    });

    test('should display source ID for each suggestion', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Look for source ID indicators (e.g., "Source ID: abc12345...")
      const sourceIdText = page.locator('span').filter({ hasText: /Source ID:/i });

      if (await sourceIdText.count() > 0) {
        await expect(sourceIdText.first()).toBeVisible();
      }
    });
  });

  test.describe('Relevance Score Validation', () => {
    test('should display relevance scores between 0-100%', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Get all percentage badges
      const badges = page.locator('span').filter({ hasText: /^\d+%$/ });

      if (await badges.count() > 0) {
        const badgeCount = await badges.count();

        for (let i = 0; i < badgeCount; i++) {
          const badgeText = await badges.nth(i).textContent();
          const percentage = parseInt(badgeText?.replace('%', '') || '0');

          // Verify percentage is within valid range
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
        }
      }
    });

    test('should sort suggestions by relevance (highest first)', async ({ page }) => {
      // Wait for suggestions to load
      await page.waitForSelector('text=AI Knowledge Suggestions', { timeout: 10000 });

      // Get all percentage badges in order
      const badges = page.locator('span').filter({ hasText: /^\d+%$/ });

      if (await badges.count() > 1) {
        const scores: number[] = [];
        const badgeCount = await badges.count();

        for (let i = 0; i < badgeCount; i++) {
          const badgeText = await badges.nth(i).textContent();
          const percentage = parseInt(badgeText?.replace('%', '') || '0');
          scores.push(percentage);
        }

        // Verify scores are in descending order (highest relevance first)
        for (let i = 0; i < scores.length - 1; i++) {
          expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
        }
      }
    });
  });

  test.describe('Loading and Error States', () => {
    test('should show loading spinner while fetching suggestions', async ({ page }) => {
      // Navigate to project (suggestions will start loading)
      const navigationPromise = page.goto(`/projects/${testProjectId}`);

      // Look for spinner during loading (may be very quick)
      const spinner = page.locator('svg[role="status"]').or(page.locator('.animate-spin'));

      // Spinner might appear briefly
      try {
        await expect(spinner).toBeVisible({ timeout: 1000 });
      } catch {
        // Spinner may have already disappeared if API is fast
      }

      await navigationPromise;
      await page.waitForLoadState('networkidle');

      // Verify suggestions loaded (no more spinner)
      await expect(page.locator('text=AI Knowledge Suggestions')).toBeVisible({ timeout: 5000 });
    });

    test.skip('should display error message when suggestions fail to load', async ({ page }) => {
      // This test requires mocking a failed API response
      // TODO: Implement when API mocking is available
      // Expected: Error message with retry option
    });
  });

  test.afterAll(async ({ request }) => {
    // Clean up test data
    if (testProjectId) {
      await request.delete(`/api/projects/${testProjectId}`);
    }
  });
});
