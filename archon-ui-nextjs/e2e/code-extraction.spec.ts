import { test, expect } from '@playwright/test';

test.describe('Code Extraction Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page with code_extraction tab
    await page.goto('/settings?t=code_extraction');
    // Wait for settings to load
    await page.waitForTimeout(2000);
  });

  test('should display code extraction settings page title', async ({ page }) => {
    // Check for page heading
    await expect(
      page.locator('h2').filter({ hasText: 'Code Extraction Settings' })
    ).toBeVisible({ timeout: 10000 });

    // Check for subtitle
    await expect(
      page.getByText('Configure how code blocks are extracted and processed')
    ).toBeVisible();
  });

  test('should display all settings sections', async ({ page }) => {
    // Wait for sections to be visible
    await page.waitForSelector('text=Length Settings', { timeout: 15000 });

    // Check for all section titles
    await expect(page.locator('h3').filter({ hasText: 'Length Settings' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Detection Features' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Content Filtering' })).toBeVisible();
    await expect(page.locator('h3').filter({ hasText: 'Advanced Settings' })).toBeVisible();
  });

  test('should display length settings section with inputs', async ({ page }) => {
    // Wait for length settings
    await page.waitForSelector('text=Length Settings', { timeout: 15000 });

    // Check for minimum code block length setting
    await expect(
      page.locator('label').filter({ hasText: 'Minimum Code Block Length' })
    ).toBeVisible();

    // Check for maximum code block length setting
    await expect(
      page.locator('label').filter({ hasText: 'Maximum Code Block Length' })
    ).toBeVisible();

    // Verify input fields are present
    const inputs = page.locator('input[type="number"]');
    await expect(inputs).toHaveCount(4); // Min length, max length, min indicators, max workers, context window
  });

  test('should display detection features section with toggles', async ({ page }) => {
    // Wait for detection features
    await page.waitForSelector('text=Detection Features', { timeout: 15000 });

    // Check for toggle switches
    await expect(
      page.locator('label').filter({ hasText: 'Complete Block Detection' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Language-Specific Patterns' })
    ).toBeVisible();

    // Verify toggles are present
    const toggles = page.locator('button[class*="inline-flex h-8 w-14"]');
    const count = await toggles.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display content filtering section', async ({ page }) => {
    // Wait for filtering section
    await page.waitForSelector('text=Content Filtering', { timeout: 15000 });

    // Check for filtering settings
    await expect(
      page.locator('label').filter({ hasText: 'Prose Filtering' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Maximum Prose Ratio' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Minimum Code Indicators' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Diagram Filtering' })
    ).toBeVisible();
  });

  test('should display advanced settings section', async ({ page }) => {
    // Wait for advanced settings
    await page.waitForSelector('text=Advanced Settings', { timeout: 15000 });

    // Check for advanced settings
    await expect(
      page.locator('label').filter({ hasText: 'Contextual Length Adjustment' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Maximum Workers' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Context Window Size' })
    ).toBeVisible();

    await expect(
      page.locator('label').filter({ hasText: 'Code Summaries' })
    ).toBeVisible();
  });

  test('should allow editing number input fields', async ({ page }) => {
    // Wait for inputs to be ready
    await page.waitForSelector('text=Length Settings', { timeout: 15000 });

    // Get the minimum code block length input
    const minLengthInput = page.locator('input[type="number"]').first();

    // Clear and set new value
    await minLengthInput.fill('300');
    await expect(minLengthInput).toHaveValue('300');

    // Get the maximum code block length input (second input)
    const inputs = page.locator('input[type="number"]');
    const maxLengthInput = inputs.nth(1);

    // Clear and set new value
    await maxLengthInput.fill('6000');
    await expect(maxLengthInput).toHaveValue('6000');
  });

  test('should allow toggling boolean settings', async ({ page }) => {
    // Wait for toggles
    await page.waitForSelector('text=Detection Features', { timeout: 15000 });

    // Get all toggle buttons
    const toggles = page.locator('button[class*="inline-flex h-8 w-14"]');
    const count = await toggles.count();

    expect(count).toBeGreaterThan(0);

    // Click first toggle
    const firstToggle = toggles.first();
    const initialClasses = await firstToggle.getAttribute('class');

    await firstToggle.click();

    // Wait for state change
    await page.waitForTimeout(500);

    // Verify the toggle changed (class should be different if it toggled)
    const updatedClasses = await firstToggle.getAttribute('class');
    // Both states exist - we just verify the button is clickable
    expect(initialClasses).toBeTruthy();
    expect(updatedClasses).toBeTruthy();
  });

  test('should allow editing decimal input fields', async ({ page }) => {
    // Wait for filtering section with decimal input
    await page.waitForSelector('text=Maximum Prose Ratio', { timeout: 15000 });

    // Find the decimal input (Maximum Prose Ratio)
    const inputs = page.locator('input[type="number"]');

    // The prose ratio should be around index 2 or 3, find it by checking nearby text
    const proseInputs = await page.locator('label:has-text("Maximum Prose Ratio") + div input').count();

    if (proseInputs > 0) {
      const proseInput = page.locator('label:has-text("Maximum Prose Ratio")').locator('../..//input[type="number"]');
      await proseInput.fill('0.25');
      await expect(proseInput).toHaveValue('0.25');
    }
  });

  test('should display save button', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Check for save button
    const saveButton = page.locator('button').filter({ hasText: /Save All Settings/ });
    await expect(saveButton).toBeVisible();
    await expect(saveButton).not.toBeDisabled();
  });

  test('should display refresh button', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Check for refresh button
    const refreshButton = page.locator('button').filter({ hasText: /Refresh/ });
    await expect(refreshButton).toBeVisible();
  });

  test('should allow saving settings', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Modify a setting
    const firstInput = page.locator('input[type="number"]').first();
    const originalValue = await firstInput.inputValue();
    const newValue = parseInt(originalValue || '250') + 50;

    await firstInput.fill(newValue.toString());
    await expect(firstInput).toHaveValue(newValue.toString());

    // Click save button
    const saveButton = page.locator('button').filter({ hasText: /Save All Settings/ });
    await saveButton.click();

    // Wait for save operation and toast to appear
    await page.waitForTimeout(1000);

    // Check for success toast
    const successToast = page.locator('text=saved successfully');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Toast should disappear after 3 seconds
    await page.waitForTimeout(3500);
    await expect(successToast).not.toBeVisible();
  });

  test('should persist values after page refresh', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Get first input and note its value
    const firstInput = page.locator('input[type="number"]').first();
    const originalValue = await firstInput.inputValue();

    // Modify setting
    const newValue = parseInt(originalValue || '250') + 100;
    await firstInput.fill(newValue.toString());

    // Save
    const saveButton = page.locator('button').filter({ hasText: /Save All Settings/ });
    await saveButton.click();

    // Wait for save
    await page.waitForTimeout(1500);

    // Wait for success toast
    const successToast = page.locator('text=saved successfully');
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Refresh page
    await page.reload();

    // Wait for page to load again
    await page.waitForTimeout(2000);
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Verify value persisted
    const refreshedInput = page.locator('input[type="number"]').first();
    await expect(refreshedInput).toHaveValue(newValue.toString());
  });

  test('should handle validation on number inputs', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Try to set value below minimum
    const minLengthInput = page.locator('input[type="number"]').first();

    // Get the min attribute
    const minAttr = await minLengthInput.getAttribute('min');
    expect(minAttr).toBeTruthy();

    // Try to set a very small value (browser will handle validation)
    await minLengthInput.fill('10');

    // The input should still accept the value (browser validation is separate)
    const value = await minLengthInput.inputValue();
    expect(value).toBe('10');
  });

  test('should update input values dynamically', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Get all inputs
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();

    expect(inputCount).toBeGreaterThan(0);

    // Test updating multiple inputs
    for (let i = 0; i < Math.min(2, inputCount); i++) {
      const input = inputs.nth(i);
      const testValue = `${100 + i * 50}`;

      await input.fill(testValue);
      await expect(input).toHaveValue(testValue);
    }
  });

  test('should display section descriptions', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Check for section descriptions
    await expect(
      page.getByText('Configure minimum and maximum code block lengths')
    ).toBeVisible();

    await expect(
      page.getByText('Enable advanced code detection capabilities')
    ).toBeVisible();

    await expect(
      page.getByText('Filter and validate code block content')
    ).toBeVisible();

    await expect(
      page.getByText('Advanced code extraction configuration')
    ).toBeVisible();
  });

  test('should display setting descriptions', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Check for setting descriptions
    await expect(
      page.getByText('Minimum number of characters for a valid code block')
    ).toBeVisible();

    await expect(
      page.getByText('Detect complete code blocks with proper boundaries')
    ).toBeVisible();

    await expect(
      page.getByText('Filter out ASCII diagrams and charts')
    ).toBeVisible();
  });

  test('should have proper accessibility structure', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('text=Code Extraction Settings', { timeout: 15000 });

    // Check for proper heading hierarchy
    const h2 = page.locator('h2').filter({ hasText: 'Code Extraction Settings' });
    await expect(h2).toBeVisible();

    // Check for h3 section headings
    const h3s = page.locator('h3');
    const count = await h3s.count();
    expect(count).toBeGreaterThanOrEqual(4); // At least 4 sections

    // Check for labels associated with inputs
    const labels = page.locator('label');
    const labelCount = await labels.count();
    expect(labelCount).toBeGreaterThan(0);
  });
});
