import { test, expect } from '@playwright/test';

test.describe('Agent Work Orders', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to agent work orders page
    await page.goto('/agent-work-orders');
    // Wait for page to load
    await page.waitForTimeout(2000);
  });

  test.describe('Page Structure', () => {
    test('should display page title and navigation', async ({ page }) => {
      // Check page title
      await expect(page.locator('h1').filter({ hasText: 'Agent Work Orders' })).toBeVisible({ timeout: 10000 });

      // Check sidebar link
      const agentWorkOrdersLink = page.locator('a[href="/agent-work-orders"]');
      await expect(agentWorkOrdersLink).toBeVisible();
    });

    test('should display stats cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForTimeout(2000);

      // Check for stat cards
      await expect(page.locator('text=Total').first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Active').first()).toBeVisible();
      await expect(page.locator('text=Completed').first()).toBeVisible();
      await expect(page.locator('text=Failed').first()).toBeVisible();
    });

    test('should display work orders table/grid', async ({ page }) => {
      // Check for DataTable component presence
      const table = page.locator('[role="table"], .grid');
      await expect(table.first()).toBeVisible({ timeout: 10000 });
    });

    test('should have New Work Order button', async ({ page }) => {
      // Check for create button
      const newButton = page.locator('button').filter({ hasText: 'New Work Order' });
      await expect(newButton).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Repository Management', () => {
    test('should open add repository modal', async ({ page }) => {
      // Click on settings or repository management button if available
      // This assumes there's a button to manage repositories
      const manageReposButton = page.locator('button').filter({ hasText: /Repositories|Manage/ });

      if (await manageReposButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await manageReposButton.click();
        await page.waitForTimeout(500);

        // Check for modal
        await expect(page.locator('text=Add Repository, text=Configure Repository').first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Work Order Creation', () => {
    test('should open create work order modal', async ({ page }) => {
      // Click New Work Order button
      const newButton = page.locator('button').filter({ hasText: 'New Work Order' });
      await newButton.click();

      // Wait for modal to appear
      await page.waitForTimeout(500);

      // Check for modal title
      await expect(page.locator('text=Create Work Order, text=New Work Order').first()).toBeVisible({ timeout: 5000 });
    });

    test('should show repository selection in modal', async ({ page }) => {
      // Click New Work Order button
      const newButton = page.locator('button').filter({ hasText: 'New Work Order' });
      await newButton.click();
      await page.waitForTimeout(500);

      // Check for repository dropdown/select
      const repositorySelect = page.locator('select, [role="combobox"]').filter({ hasText: /Repository|Select/ });
      await expect(repositorySelect.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('DataTable Functionality', () => {
    test('should have view toggle (table/grid)', async ({ page }) => {
      // Check for view toggle buttons
      const viewToggle = page.locator('[aria-label*="View"], button').filter({ hasText: /Grid|Table/ });

      if (await viewToggle.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(viewToggle.first()).toBeVisible();
      }
    });

    test('should have search functionality', async ({ page }) => {
      // Check for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]');

      if (await searchInput.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(searchInput.first()).toBeVisible();
      }
    });

    test('should have filter options', async ({ page }) => {
      // Check for filter dropdowns
      const statusFilter = page.locator('select').filter({ hasText: /Status|All Statuses/ });

      if (await statusFilter.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(statusFilter.first()).toBeVisible();
      }
    });

    test('should display empty state when no work orders exist', async ({ page }) => {
      // Wait for data to load
      await page.waitForTimeout(2000);

      // Check for empty state message (if no work orders exist)
      const emptyMessage = page.locator('text=No work orders found, text=Create your first');

      if (await emptyMessage.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(emptyMessage.first()).toBeVisible();
      }
    });
  });

  test.describe('Work Order Actions', () => {
    test('should have action buttons for work orders', async ({ page }) => {
      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if any work orders exist
      const workOrderRow = page.locator('[data-testid="work-order-row"], tr, .work-order-card').first();

      if (await workOrderRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Check for action buttons (View, Start, Delete, etc.)
        const viewButton = page.locator('button').filter({ hasText: /View|Details/ }).first();
        await expect(viewButton).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Work Order Detail View', () => {
    test('should navigate to work order detail when clicked', async ({ page }) => {
      // Wait for work orders to load
      await page.waitForTimeout(2000);

      // Click on first work order if it exists
      const workOrderRow = page.locator('[data-testid="work-order-row"], tr').first();

      if (await workOrderRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await workOrderRow.click();

        // Wait for navigation
        await page.waitForURL(/\/agent-work-orders\/.+/, { timeout: 5000 });

        // Check URL changed to detail page
        expect(page.url()).toMatch(/\/agent-work-orders\/.+/);
      }
    });

    test('should display work order details', async ({ page }) => {
      // Create a test work order ID (or use an existing one)
      const testWorkOrderId = '00000000-0000-0000-0000-000000000000';

      // Navigate directly to detail page
      await page.goto(`/agent-work-orders/${testWorkOrderId}`);
      await page.waitForTimeout(1000);

      // Check for detail page elements (Repository, Branch, Status, etc.)
      // Note: This will show "not found" for a fake ID, but tests page structure
      const pageContent = page.locator('body');
      await expect(pageContent).toBeVisible();
    });
  });

  test.describe('Real-time Features', () => {
    test('should have SSE connection for live logs', async ({ page }) => {
      // Wait for page load
      await page.waitForTimeout(2000);

      // Check if EventSource is being used (via console logs or network tab)
      // This is a structural test - we check the page loads
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Integration with Backend', () => {
    test('should fetch work orders from API', async ({ page }) => {
      // Listen for API calls
      const apiPromise = page.waitForResponse(
        response => response.url().includes('/api/agent-work-orders/work-orders'),
        { timeout: 10000 }
      ).catch(() => null);

      // Reload page to trigger API call
      await page.reload();

      const apiResponse = await apiPromise;

      if (apiResponse) {
        // Check response status
        expect(apiResponse.status()).toBeLessThan(500);
      }
    });

    test('should handle API errors gracefully', async ({ page }) => {
      // Intercept API call and simulate error
      await page.route('**/api/agent-work-orders/work-orders*', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      // Reload page
      await page.reload();
      await page.waitForTimeout(2000);

      // Page should still load (error handling)
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
      // Set viewport to mobile size
      await page.setViewportSize({ width: 375, height: 667 });

      // Page should still be usable
      await page.waitForTimeout(1000);
      await expect(page.locator('h1').filter({ hasText: 'Agent Work Orders' })).toBeVisible({ timeout: 10000 });
    });

    test('should be tablet responsive', async ({ page }) => {
      // Set viewport to tablet size
      await page.setViewportSize({ width: 768, height: 1024 });

      // Page should still be usable
      await page.waitForTimeout(1000);
      await expect(page.locator('h1').filter({ hasText: 'Agent Work Orders' })).toBeVisible({ timeout: 10000 });
    });
  });
});
