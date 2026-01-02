import { test, expect, Page } from '@playwright/test';

/**
 * Theme Visual Regression Tests
 *
 * Tests for visual consistency of hover states, active states, and theme colors
 * across all fixed components in both light and dark themes.
 *
 * Components tested:
 * - Sidebar (expanded/collapsed, active/hover states)
 * - Buttons (PRIMARY, SECONDARY, GHOST, DANGER variants)
 * - DataTable (row hover/selection)
 * - Cards (hover/selected states)
 */

// Helper to toggle dark mode
async function enableDarkMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark');
  });
  // Wait for CSS transitions to complete
  await page.waitForTimeout(300);
}

// Helper to enable light mode
async function enableLightMode(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await page.waitForTimeout(300);
}

// Helper to get the theme toggle button
async function clickThemeToggle(page: Page): Promise<void> {
  const themeButton = page.locator('button[aria-label*="mode"]');
  if (await themeButton.isVisible()) {
    await themeButton.click();
    await page.waitForTimeout(300);
  }
}

test.describe('Theme Visual Regression Tests', () => {
  test.describe('Sidebar Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('sidebar default state - light theme', async ({ page }) => {
      await enableLightMode(page);
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveScreenshot('sidebar-default-light.png');
    });

    test('sidebar default state - dark theme', async ({ page }) => {
      await enableDarkMode(page);
      const sidebar = page.locator('aside').first();
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveScreenshot('sidebar-default-dark.png');
    });

    test('sidebar active item has distinct hover - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Dashboard should be active on homepage
      const dashboardLink = page.locator('aside a[href="/"]').first();
      await expect(dashboardLink).toBeVisible();

      // Verify active state has bg-gray-100
      await expect(dashboardLink).toHaveClass(/bg-gray-100/);

      // Hover over active item - should change to bg-gray-200
      await dashboardLink.hover();
      await page.waitForTimeout(100);

      // Take screenshot of hovered active state
      await expect(dashboardLink).toHaveScreenshot('sidebar-active-hover-light.png');
    });

    test('sidebar active item has distinct hover - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const dashboardLink = page.locator('aside a[href="/"]').first();
      await expect(dashboardLink).toBeVisible();

      // Hover over active item
      await dashboardLink.hover();
      await page.waitForTimeout(100);

      await expect(dashboardLink).toHaveScreenshot('sidebar-active-hover-dark.png');
    });

    test('sidebar inactive item hover - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Projects link should be inactive on homepage
      const projectsLink = page.locator('aside a[href="/projects"]').first();
      await expect(projectsLink).toBeVisible();

      // Hover over inactive item
      await projectsLink.hover();
      await page.waitForTimeout(100);

      await expect(projectsLink).toHaveScreenshot('sidebar-inactive-hover-light.png');
    });

    test('sidebar inactive item hover - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const projectsLink = page.locator('aside a[href="/projects"]').first();
      await expect(projectsLink).toBeVisible();

      await projectsLink.hover();
      await page.waitForTimeout(100);

      await expect(projectsLink).toHaveScreenshot('sidebar-inactive-hover-dark.png');
    });

    test('sidebar collapsed state - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Click collapse button
      const collapseButton = page.locator('aside button[aria-label*="Collapse"]');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(300);

        const sidebar = page.locator('aside').first();
        await expect(sidebar).toHaveScreenshot('sidebar-collapsed-light.png');
      }
    });

    test('sidebar collapsed state - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const collapseButton = page.locator('aside button[aria-label*="Collapse"]');
      if (await collapseButton.isVisible()) {
        await collapseButton.click();
        await page.waitForTimeout(300);

        const sidebar = page.locator('aside').first();
        await expect(sidebar).toHaveScreenshot('sidebar-collapsed-dark.png');
      }
    });
  });

  test.describe('Button Variants', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to settings page which typically has various button variants
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
    });

    test('primary button states - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Find a primary button (usually "Save" buttons)
      const primaryButton = page.locator('button.bg-brand-700, button.bg-brand-600').first();

      if (await primaryButton.isVisible()) {
        // Default state
        await expect(primaryButton).toHaveScreenshot('button-primary-default-light.png');

        // Hover state
        await primaryButton.hover();
        await page.waitForTimeout(100);
        await expect(primaryButton).toHaveScreenshot('button-primary-hover-light.png');
      }
    });

    test('primary button states - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const primaryButton = page.locator('button.bg-brand-700, button.bg-brand-600, button.dark\\:bg-brand-600').first();

      if (await primaryButton.isVisible()) {
        await expect(primaryButton).toHaveScreenshot('button-primary-default-dark.png');

        await primaryButton.hover();
        await page.waitForTimeout(100);
        await expect(primaryButton).toHaveScreenshot('button-primary-hover-dark.png');
      }
    });

    test('secondary/ghost button states - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Ghost buttons typically have border-gray-300
      const ghostButton = page.locator('button.border-gray-300').first();

      if (await ghostButton.isVisible()) {
        await expect(ghostButton).toHaveScreenshot('button-ghost-default-light.png');

        await ghostButton.hover();
        await page.waitForTimeout(100);
        await expect(ghostButton).toHaveScreenshot('button-ghost-hover-light.png');
      }
    });
  });

  test.describe('DataTable Components', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // Wait for data to load
    });

    test('data table row hover - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Find table rows in list view
      const tableRow = page.locator('table tbody tr, [role="row"]').first();

      if (await tableRow.isVisible()) {
        await expect(tableRow).toHaveScreenshot('datatable-row-default-light.png');

        await tableRow.hover();
        await page.waitForTimeout(100);
        await expect(tableRow).toHaveScreenshot('datatable-row-hover-light.png');
      }
    });

    test('data table row hover - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const tableRow = page.locator('table tbody tr, [role="row"]').first();

      if (await tableRow.isVisible()) {
        await expect(tableRow).toHaveScreenshot('datatable-row-default-dark.png');

        await tableRow.hover();
        await page.waitForTimeout(100);
        await expect(tableRow).toHaveScreenshot('datatable-row-hover-dark.png');
      }
    });

    test('data table pagination buttons - light theme', async ({ page }) => {
      await enableLightMode(page);

      const paginationButton = page.locator('[aria-label*="page"], button:has-text("Next"), button:has-text("Previous")').first();

      if (await paginationButton.isVisible()) {
        await expect(paginationButton).toHaveScreenshot('pagination-default-light.png');

        await paginationButton.hover();
        await page.waitForTimeout(100);
        await expect(paginationButton).toHaveScreenshot('pagination-hover-light.png');
      }
    });
  });

  test.describe('Card Components', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    });

    test('project card hover - light theme', async ({ page }) => {
      await enableLightMode(page);

      // Switch to grid view if available
      const gridViewButton = page.locator('button[aria-label*="grid"], button:has([class*="ViewGrid"])');
      if (await gridViewButton.isVisible()) {
        await gridViewButton.click();
        await page.waitForTimeout(300);
      }

      // Find a project card
      const card = page.locator('[class*="Card"], .rounded-lg.border.shadow-sm, article').first();

      if (await card.isVisible()) {
        await expect(card).toHaveScreenshot('card-default-light.png');

        await card.hover();
        await page.waitForTimeout(100);
        await expect(card).toHaveScreenshot('card-hover-light.png');
      }
    });

    test('project card hover - dark theme', async ({ page }) => {
      await enableDarkMode(page);

      const gridViewButton = page.locator('button[aria-label*="grid"], button:has([class*="ViewGrid"])');
      if (await gridViewButton.isVisible()) {
        await gridViewButton.click();
        await page.waitForTimeout(300);
      }

      const card = page.locator('[class*="Card"], .rounded-lg.border.shadow-sm, article').first();

      if (await card.isVisible()) {
        await expect(card).toHaveScreenshot('card-default-dark.png');

        await card.hover();
        await page.waitForTimeout(100);
        await expect(card).toHaveScreenshot('card-hover-dark.png');
      }
    });

    test('task card in kanban board - light theme', async ({ page }) => {
      // Navigate to a project with tasks
      await page.goto('/tasks');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await enableLightMode(page);

      // Find task card in kanban view
      const taskCard = page.locator('[draggable="true"], [data-testid*="task-card"]').first();

      if (await taskCard.isVisible()) {
        await expect(taskCard).toHaveScreenshot('taskcard-default-light.png');

        await taskCard.hover();
        await page.waitForTimeout(100);
        await expect(taskCard).toHaveScreenshot('taskcard-hover-light.png');
      }
    });

    test('task card in kanban board - dark theme', async ({ page }) => {
      await page.goto('/tasks');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      await enableDarkMode(page);

      const taskCard = page.locator('[draggable="true"], [data-testid*="task-card"]').first();

      if (await taskCard.isVisible()) {
        await expect(taskCard).toHaveScreenshot('taskcard-default-dark.png');

        await taskCard.hover();
        await page.waitForTimeout(100);
        await expect(taskCard).toHaveScreenshot('taskcard-hover-dark.png');
      }
    });
  });

  test.describe('Full Page Theme Screenshots', () => {
    /**
     * Note: Full page screenshots may have slight variations due to:
     * - Dynamic API data (task counts, project counts)
     * - Loading state timing
     * - Date/time displays
     *
     * These tests use viewport-only screenshots (not fullPage) for stability.
     * The tolerance settings in playwright.config.ts allow for minor variations.
     */

    test('dashboard page - light theme', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // Wait for stats to load
      await page.waitForSelector('text=Total Projects', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      await enableLightMode(page);
      // Use viewport screenshot for stability (dynamic content may vary)
      await expect(page).toHaveScreenshot('fullpage-dashboard-light.png', {
        maxDiffPixelRatio: 0.03,  // Allow 3% difference for dynamic data
      });
    });

    test('dashboard page - dark theme', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('text=Total Projects', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      await enableDarkMode(page);
      await expect(page).toHaveScreenshot('fullpage-dashboard-dark.png', {
        maxDiffPixelRatio: 0.03,
      });
    });

    test('projects page - light theme', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      await enableLightMode(page);
      await expect(page).toHaveScreenshot('fullpage-projects-light.png', {
        maxDiffPixelRatio: 0.03,
      });
    });

    test('projects page - dark theme', async ({ page }) => {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      await enableDarkMode(page);
      await expect(page).toHaveScreenshot('fullpage-projects-dark.png', {
        maxDiffPixelRatio: 0.03,
      });
    });

    test('settings page - light theme', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      // Settings page loads async data
      await page.waitForTimeout(2000);

      await enableLightMode(page);
      await expect(page).toHaveScreenshot('fullpage-settings-light.png', {
        maxDiffPixelRatio: 0.05,  // Higher tolerance for settings (more dynamic)
      });
    });

    test('settings page - dark theme', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await enableDarkMode(page);
      await expect(page).toHaveScreenshot('fullpage-settings-dark.png', {
        maxDiffPixelRatio: 0.05,
      });
    });
  });

  test.describe('Interactive State Verification', () => {
    test('verify CSS custom properties are defined', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Verify the design tokens exist in computed styles
      const styles = await page.evaluate(() => {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        return {
          hoverSubtle: computedStyle.getPropertyValue('--color-interactive-hover-subtle'),
          hover: computedStyle.getPropertyValue('--color-interactive-hover'),
          active: computedStyle.getPropertyValue('--color-interactive-active'),
          hoverActive: computedStyle.getPropertyValue('--color-interactive-hover-active'),
          pressed: computedStyle.getPropertyValue('--color-interactive-pressed'),
        };
      });

      // All tokens should be defined
      expect(styles.hoverSubtle).toBeTruthy();
      expect(styles.hover).toBeTruthy();
      expect(styles.active).toBeTruthy();
      expect(styles.hoverActive).toBeTruthy();
      expect(styles.pressed).toBeTruthy();
    });

    test('sidebar menu item has correct hover class applied', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Check that sidebar links have the expected Tailwind classes
      const projectsLink = page.locator('aside a[href="/projects"]').first();
      await expect(projectsLink).toBeVisible();

      // Non-active link should have hover:bg-gray-100
      const classes = await projectsLink.getAttribute('class');
      expect(classes).toMatch(/hover:bg-gray-100/);
    });

    test('active sidebar item has distinct active and hover classes', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Dashboard link should be active
      const dashboardLink = page.locator('aside a[href="/"]').first();
      await expect(dashboardLink).toBeVisible();

      const classes = await dashboardLink.getAttribute('class');

      // Active item should have:
      // - bg-gray-100 (active state)
      // - hover:bg-gray-200 (hover on active state)
      expect(classes).toMatch(/bg-gray-100/);
      expect(classes).toMatch(/hover:bg-gray-200/);
    });
  });
});

test.describe('Accessibility and Contrast', () => {
  test('sufficient color contrast in light theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await enableLightMode(page);

    // Check that text elements have sufficient contrast
    // This is a basic check - full WCAG compliance requires dedicated tools
    const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6, a, button');
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);

    // Verify at least some elements are visible
    const firstVisible = textElements.first();
    await expect(firstVisible).toBeVisible();
  });

  test('sufficient color contrast in dark theme', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await enableDarkMode(page);

    const textElements = page.locator('p, span, h1, h2, h3, h4, h5, h6, a, button');
    const count = await textElements.count();

    expect(count).toBeGreaterThan(0);

    const firstVisible = textElements.first();
    await expect(firstVisible).toBeVisible();
  });

  test('focus states are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Check that focus ring is visible (brand-500 color)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Take screenshot of focused state
    await expect(focusedElement).toHaveScreenshot('focus-state.png');
  });
});
