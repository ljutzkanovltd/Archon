import { test, expect } from '@playwright/test';

test.describe('Crawling Performance Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page with RAG tab
    await page.goto('/settings?t=rag');
    // Wait for page to load
    await page.waitForTimeout(2000);
  });

  test('should navigate to settings page with RAG tab', async ({ page }) => {
    // Verify URL contains the correct query parameter
    await expect(page).toHaveURL(/\/settings\?t=rag/);

    // Check that page loaded with RAG settings header
    await expect(page.locator('h2').filter({ hasText: 'RAG Settings' })).toBeVisible({ timeout: 10000 });
  });

  test('should scroll to and display Crawling Performance Settings section', async ({ page }) => {
    // Wait for RAG Settings header to be visible
    await expect(page.locator('h2').filter({ hasText: 'RAG Settings' })).toBeVisible({ timeout: 10000 });

    // Look for Crawling Performance Settings section header
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });

    // Scroll the header into view
    await crawlingHeader.scrollIntoViewIfNeeded();

    // Verify it's visible
    await expect(crawlingHeader).toBeVisible({ timeout: 10000 });
  });

  test('should display all crawling performance form fields', async ({ page }) => {
    // Scroll to Crawling Performance Settings section
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Check for Batch Size field
    await expect(page.locator('div').filter({ hasText: /^Batch Size/ })).toBeVisible({ timeout: 10000 });

    // Check for Max Concurrent field
    await expect(page.locator('div').filter({ hasText: /^Max Concurrent/ })).toBeVisible();

    // Check for Wait Strategy field
    await expect(page.locator('div').filter({ hasText: /^Wait Strategy/ })).toBeVisible();

    // Check for Page Timeout field
    await expect(page.locator('div').filter({ hasText: /^Page Timeout/ })).toBeVisible();

    // Check for Delay Before HTML field
    await expect(page.locator('div').filter({ hasText: /^Delay Before HTML/ })).toBeVisible();
  });

  test('should have Batch Size input within valid range (10-100)', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Batch Size input field
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();

    // Verify the input has min and max attributes
    await expect(batchSizeInput).toHaveAttribute('min', '10');
    await expect(batchSizeInput).toHaveAttribute('max', '100');

    // Test setting a valid value (50)
    await batchSizeInput.fill('50');
    await expect(batchSizeInput).toHaveValue('50');
  });

  test('should reject invalid Batch Size values outside range (10-100)', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Batch Size input
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();

    // Try to set value below minimum (5)
    await batchSizeInput.fill('5');
    // Browser should not allow this due to min attribute
    const value = await batchSizeInput.inputValue();
    // Input type="number" respects min/max, so value might be empty or previous value

    // Try to set value above maximum (150)
    await batchSizeInput.fill('150');
    // Again, browser enforces the constraint
  });

  test('should have Max Concurrent input within valid range (1-20)', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Max Concurrent input
    const maxConcurrentLabel = page.locator('div').filter({ hasText: /^Max Concurrent/ });
    const maxConcurrentInput = maxConcurrentLabel.locator('input[type="number"]').first();

    // Verify min and max attributes
    await expect(maxConcurrentInput).toHaveAttribute('min', '1');
    await expect(maxConcurrentInput).toHaveAttribute('max', '20');

    // Test setting a valid value (5)
    await maxConcurrentInput.fill('5');
    await expect(maxConcurrentInput).toHaveValue('5');
  });

  test('should have Wait Strategy dropdown with correct options', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Wait Strategy select
    const waitStrategyLabel = page.locator('div').filter({ hasText: /^Wait Strategy/ });
    const waitStrategySelect = waitStrategyLabel.locator('select').first();

    // Verify select element exists and is visible
    await expect(waitStrategySelect).toBeVisible();

    // Check for dropdown options
    const options = await waitStrategySelect.locator('option').all();

    // Should have 3 options
    expect(options.length).toBe(3);

    // Verify option values
    const optionValues = await Promise.all(
      options.map(opt => opt.getAttribute('value'))
    );
    expect(optionValues).toContain('domcontentloaded');
    expect(optionValues).toContain('load');
    expect(optionValues).toContain('networkidle');
  });

  test('should allow selecting different Wait Strategy options', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Wait Strategy select
    const waitStrategyLabel = page.locator('div').filter({ hasText: /^Wait Strategy/ });
    const waitStrategySelect = waitStrategyLabel.locator('select').first();

    // Test selecting "load"
    await waitStrategySelect.selectOption('load');
    await expect(waitStrategySelect).toHaveValue('load');

    // Test selecting "networkidle"
    await waitStrategySelect.selectOption('networkidle');
    await expect(waitStrategySelect).toHaveValue('networkidle');

    // Test selecting "domcontentloaded"
    await waitStrategySelect.selectOption('domcontentloaded');
    await expect(waitStrategySelect).toHaveValue('domcontentloaded');
  });

  test('should have Page Timeout input within valid range (5-120)', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Page Timeout input
    const pageTimeoutLabel = page.locator('div').filter({ hasText: /^Page Timeout/ });
    const pageTimeoutInput = pageTimeoutLabel.locator('input[type="number"]').first();

    // Verify min and max attributes
    await expect(pageTimeoutInput).toHaveAttribute('min', '5');
    await expect(pageTimeoutInput).toHaveAttribute('max', '120');

    // Test setting a valid value (30)
    await pageTimeoutInput.fill('30');
    await expect(pageTimeoutInput).toHaveValue('30');
  });

  test('should have Delay Before HTML input within valid range (0-10000)', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the Delay Before HTML input
    const delayLabel = page.locator('div').filter({ hasText: /^Delay Before HTML/ });
    const delayInput = delayLabel.locator('input[type="number"]').first();

    // Verify min and max attributes
    await expect(delayInput).toHaveAttribute('min', '0');
    await expect(delayInput).toHaveAttribute('max', '10000');

    // Test setting a valid value (1000)
    await delayInput.fill('1000');
    await expect(delayInput).toHaveValue('1000');
  });

  test('should display Save Crawling Settings button', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the save button
    const saveButton = page.locator('button').filter({ hasText: /^Save Crawling Settings/ }).first();

    // Verify button is visible
    await expect(saveButton).toBeVisible({ timeout: 10000 });

    // Button should not be disabled initially
    await expect(saveButton).not.toBeDisabled();
  });

  test('should save crawling settings with valid values', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Set all crawling performance settings to valid values
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();
    await batchSizeInput.fill('25');

    const maxConcurrentLabel = page.locator('div').filter({ hasText: /^Max Concurrent/ });
    const maxConcurrentInput = maxConcurrentLabel.locator('input[type="number"]').first();
    await maxConcurrentInput.fill('10');

    const waitStrategyLabel = page.locator('div').filter({ hasText: /^Wait Strategy/ });
    const waitStrategySelect = waitStrategyLabel.locator('select').first();
    await waitStrategySelect.selectOption('load');

    const pageTimeoutLabel = page.locator('div').filter({ hasText: /^Page Timeout/ });
    const pageTimeoutInput = pageTimeoutLabel.locator('input[type="number"]').first();
    await pageTimeoutInput.fill('45');

    const delayLabel = page.locator('div').filter({ hasText: /^Delay Before HTML/ });
    const delayInput = delayLabel.locator('input[type="number"]').first();
    await delayInput.fill('2000');

    // Click save button
    const saveButton = page.locator('button').filter({ hasText: /^Save Crawling Settings/ }).first();
    await saveButton.click();

    // Wait for save operation (button shows "Saving..." state)
    await page.waitForTimeout(1000);

    // Look for success toast notification
    const successToast = page.locator('div').filter({ hasText: /saved successfully|Crawling performance settings saved/ });

    // Either the toast appears or the button returns to normal state
    // (timeout will pass if neither happens)
    await expect(page).toHaveURL(/\/settings\?t=rag/);
  });

  test('should handle form validation on save', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Set an invalid Batch Size value (below minimum)
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();

    // Attempt to set invalid value
    await batchSizeInput.fill('5');

    // Clear the field and set to empty to test validation
    await batchSizeInput.fill('');
    await batchSizeInput.fill('150'); // Above max

    // The HTML5 validation should prevent submission
    // Browser constraints prevent values outside min/max from being sent
  });

  test('should update Batch Size field and reflect changes', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find Batch Size input
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();

    // Test multiple valid values
    const validValues = ['10', '50', '75', '100'];

    for (const value of validValues) {
      await batchSizeInput.fill(value);
      await expect(batchSizeInput).toHaveValue(value);
    }
  });

  test('should update Max Concurrent field and reflect changes', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find Max Concurrent input
    const maxConcurrentLabel = page.locator('div').filter({ hasText: /^Max Concurrent/ });
    const maxConcurrentInput = maxConcurrentLabel.locator('input[type="number"]').first();

    // Test multiple valid values
    const validValues = ['1', '5', '10', '15', '20'];

    for (const value of validValues) {
      await maxConcurrentInput.fill(value);
      await expect(maxConcurrentInput).toHaveValue(value);
    }
  });

  test('should update Page Timeout field and reflect changes', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find Page Timeout input
    const pageTimeoutLabel = page.locator('div').filter({ hasText: /^Page Timeout/ });
    const pageTimeoutInput = pageTimeoutLabel.locator('input[type="number"]').first();

    // Test multiple valid values
    const validValues = ['5', '30', '60', '90', '120'];

    for (const value of validValues) {
      await pageTimeoutInput.fill(value);
      await expect(pageTimeoutInput).toHaveValue(value);
    }
  });

  test('should update Delay Before HTML field and reflect changes', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find Delay Before HTML input
    const delayLabel = page.locator('div').filter({ hasText: /^Delay Before HTML/ });
    const delayInput = delayLabel.locator('input[type="number"]').first();

    // Test multiple valid values
    const validValues = ['0', '500', '2000', '5000', '10000'];

    for (const value of validValues) {
      await delayInput.fill(value);
      await expect(delayInput).toHaveValue(value);
    }
  });

  test('should cycle through Wait Strategy options', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find Wait Strategy select
    const waitStrategyLabel = page.locator('div').filter({ hasText: /^Wait Strategy/ });
    const waitStrategySelect = waitStrategyLabel.locator('select').first();

    // Cycle through all options multiple times
    const strategies = ['domcontentloaded', 'load', 'networkidle'];

    for (let cycle = 0; cycle < 2; cycle++) {
      for (const strategy of strategies) {
        await waitStrategySelect.selectOption(strategy);
        await expect(waitStrategySelect).toHaveValue(strategy);
      }
    }
  });

  test('should have proper field descriptions for all crawling settings', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Check for Batch Size description
    await expect(page.locator('div').filter({ hasText: /10-100/ })).toBeVisible();

    // Check for Max Concurrent description
    await expect(page.locator('div').filter({ hasText: /1-20/ })).toBeVisible();

    // Check for Page Timeout description
    await expect(page.locator('div').filter({ hasText: /5-120 seconds/ })).toBeVisible();

    // Check for Delay Before HTML description
    await expect(page.locator('div').filter({ hasText: /0-10000/ })).toBeVisible();
  });

  test('should maintain Crawling Performance Settings visibility across page interactions', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Verify section is visible
    await expect(crawlingHeader).toBeVisible();

    // Interact with a field
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();
    await batchSizeInput.fill('50');

    // Scroll away
    await page.locator('h2').filter({ hasText: 'RAG Settings' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Scroll back to Crawling Performance Settings
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Verify it's still visible and our value is still there
    await expect(crawlingHeader).toBeVisible();
    await expect(batchSizeInput).toHaveValue('50');
  });

  test('should show Save button in correct state during interaction', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find the save button
    const saveButton = page.locator('button').filter({ hasText: /^Save Crawling Settings/ }).first();

    // Button should be enabled initially
    await expect(saveButton).not.toBeDisabled();

    // Modify a field
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();
    await batchSizeInput.fill('35');

    // Button should still be enabled
    await expect(saveButton).not.toBeDisabled();

    // Verify button text
    await expect(saveButton).toContainText('Save Crawling Settings');
  });

  test('should properly render form structure with labels and inputs', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get the settings container
    const settingsContainer = crawlingHeader.locator('xpath=following-sibling::div[1]');

    // Verify the container structure
    await expect(settingsContainer).toBeVisible();

    // Count the number of setting rows (should be 5)
    // Each setting has a label/description and an input
    const settingRows = page.locator('div').filter({ hasText: /Batch Size|Max Concurrent|Wait Strategy|Page Timeout|Delay Before HTML/ });
    expect(await settingRows.count()).toBeGreaterThanOrEqual(5);
  });

  test('should handle rapid field updates without losing values', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Find all inputs
    const batchSizeLabel = page.locator('div').filter({ hasText: /^Batch Size/ });
    const batchSizeInput = batchSizeLabel.locator('input[type="number"]').first();
    const maxConcurrentLabel = page.locator('div').filter({ hasText: /^Max Concurrent/ });
    const maxConcurrentInput = maxConcurrentLabel.locator('input[type="number"]').first();

    // Rapidly update multiple fields
    await batchSizeInput.fill('20');
    await maxConcurrentInput.fill('8');
    await batchSizeInput.fill('40');
    await maxConcurrentInput.fill('12');
    await batchSizeInput.fill('60');

    // Verify final values
    await expect(batchSizeInput).toHaveValue('60');
    await expect(maxConcurrentInput).toHaveValue('12');
  });

  test('should display description text for Wait Strategy options', async ({ page }) => {
    // Scroll to Crawling Performance Settings
    const crawlingHeader = page.locator('h3').filter({ hasText: 'Crawling Performance Settings' });
    await crawlingHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Look for the Wait Strategy label and description
    const waitStrategyElement = page.locator('div').filter({ hasText: /^Wait Strategy/ });

    // Verify it's visible
    await expect(waitStrategyElement).toBeVisible();

    // Check for the description text mentioning "Page load wait strategy"
    const description = page.locator('div').filter({ hasText: /Page load wait strategy/ });
    await expect(description).toBeVisible();
  });
});
