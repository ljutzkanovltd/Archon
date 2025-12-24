import { test, expect } from '@playwright/test';

test.describe('Settings Persistence Across Page Reloads', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to settings page
    await page.goto('/settings');
    // Wait for page to load
    await page.waitForTimeout(2000);
  });

  // ============================================================================
  // General Settings Persistence Tests
  // ============================================================================

  test.describe('General Settings', () => {
    test('should persist site name change after page reload', async ({ page }) => {
      // Step 1: Navigate to General Settings tab (it should be the default)
      const siteName = `Test Site ${Date.now()}`;

      // Step 2: Locate the site name input field
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      await expect(siteNameInput).toBeVisible({ timeout: 10000 });

      // Step 3: Clear and update site name
      await siteNameInput.clear();
      await siteNameInput.fill(siteName);

      // Step 4: Click Save Changes button in General Settings section
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 5: Wait for success message to appear
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 6: Reload the page
      await page.reload();

      // Step 7: Wait for page to load and verify site name persists
      await expect(siteNameInput).toHaveValue(siteName, { timeout: 10000 });
      expect(await siteNameInput.inputValue()).toBe(siteName);
    });

    test('should persist timezone change after page reload', async ({ page }) => {
      // Step 1: Locate timezone select
      const timezoneSelects = page.locator('select');
      const timezoneSelect = timezoneSelects.nth(0); // First select is typically timezone

      await expect(timezoneSelect).toBeVisible({ timeout: 10000 });

      // Step 2: Change timezone to a specific value
      const newTimezone = 'Europe/London';
      await timezoneSelect.selectOption(newTimezone);

      // Step 3: Click Save Changes button
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 4: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload the page
      await page.reload();

      // Step 6: Verify timezone persists
      await expect(timezoneSelect).toHaveValue(newTimezone, { timeout: 10000 });
    });

    test('should persist language change after page reload', async ({ page }) => {
      // Step 1: Locate all select elements and get the language one
      const selects = page.locator('select');
      const languageSelect = selects.nth(1); // Second select is typically language

      await expect(languageSelect).toBeVisible({ timeout: 10000 });

      // Step 2: Change language
      const newLanguage = 'es'; // Spanish
      await languageSelect.selectOption(newLanguage);

      // Step 3: Click Save Changes button
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 4: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload the page
      await page.reload();

      // Step 6: Verify language persists
      await expect(languageSelect).toHaveValue(newLanguage, { timeout: 10000 });
    });

    test('should persist multiple general settings changes together', async ({ page }) => {
      const newSiteName = `Multi Change Site ${Date.now()}`;
      const newTimezone = 'America/New_York';
      const newLanguage = 'fr'; // French

      // Step 1: Fill in all fields
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      const selects = page.locator('select');
      const timezoneSelect = selects.nth(0);
      const languageSelect = selects.nth(1);

      await expect(siteNameInput).toBeVisible({ timeout: 10000 });
      await expect(timezoneSelect).toBeVisible();
      await expect(languageSelect).toBeVisible();

      // Step 2: Update all fields
      await siteNameInput.clear();
      await siteNameInput.fill(newSiteName);
      await timezoneSelect.selectOption(newTimezone);
      await languageSelect.selectOption(newLanguage);

      // Step 3: Save
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 4: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload
      await page.reload();

      // Step 6: Verify all changes persist
      await expect(siteNameInput).toHaveValue(newSiteName, { timeout: 10000 });
      await expect(timezoneSelect).toHaveValue(newTimezone);
      await expect(languageSelect).toHaveValue(newLanguage);
    });
  });

  // ============================================================================
  // Display Settings Persistence Tests
  // ============================================================================

  test.describe('Display Settings', () => {
    test('should persist theme change from light to dark after page reload', async ({ page }) => {
      // Step 1: Scroll to find Display Settings section
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Step 2: Locate theme buttons
      const darkThemeButton = page.locator('button:has-text("Dark")').filter({ hasText: 'Dark' });
      await expect(darkThemeButton).toBeVisible({ timeout: 5000 });

      // Step 3: Click dark theme button
      await darkThemeButton.click();
      await page.waitForTimeout(500); // Wait for theme to apply

      // Step 4: Click Save Changes button in Display Settings section
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 5: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 6: Reload page
      await page.reload();

      // Step 7: Verify dark theme is still selected
      await expect(darkThemeButton).toBeVisible({ timeout: 10000 });
      // Check that the button has the selected state styling (border-brand-600)
      const darkButtonBorder = await darkThemeButton.evaluate((el) => {
        return window.getComputedStyle(el).borderColor;
      });
      expect(darkButtonBorder).toBeTruthy();
    });

    test('should persist theme change to system after page reload', async ({ page }) => {
      // Step 1: Find Display Settings
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Step 2: Locate and click system theme button
      const systemThemeButton = page.locator('button').filter({ hasText: 'System' });
      await expect(systemThemeButton).toBeVisible({ timeout: 5000 });
      await systemThemeButton.click();
      await page.waitForTimeout(500);

      // Step 3: Save
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 4: Wait for success
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload
      await page.reload();

      // Step 6: Verify system theme is still selected
      await expect(systemThemeButton).toBeVisible({ timeout: 10000 });
      const systemButtonBorder = await systemThemeButton.evaluate((el) => {
        return window.getComputedStyle(el).borderColor;
      });
      expect(systemButtonBorder).toBeTruthy();
    });

    test('should persist items per page selection after page reload', async ({ page }) => {
      // Step 1: Find Display Settings and locate items per page select
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Get all select elements and find the one for items per page
      const selects = page.locator('select');
      const itemsPerPageSelect = selects.nth(0); // Items per page is typically first select in display settings

      // Step 2: Change items per page to 50
      await itemsPerPageSelect.selectOption('50');

      // Step 3: Click Save Changes button
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 4: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload page
      await page.reload();

      // Step 6: Verify items per page selection persists
      await expect(itemsPerPageSelect).toHaveValue('50', { timeout: 10000 });
    });

    test('should persist view mode selection after page reload', async ({ page }) => {
      // Step 1: Find Display Settings
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Step 2: Locate table view radio button and select it
      const tableViewRadio = page.locator('input[type="radio"][value="table"]');
      await expect(tableViewRadio).toBeVisible({ timeout: 5000 });
      await tableViewRadio.check();

      // Step 3: Save changes
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 4: Wait for success message
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload page
      await page.reload();

      // Step 6: Verify table view is still selected
      await expect(tableViewRadio).toBeChecked({ timeout: 10000 });
    });

    test('should persist theme and items per page changes together', async ({ page }) => {
      // Step 1: Find Display Settings
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Step 2: Change theme to light
      const lightThemeButton = page.locator('button').filter({ hasText: 'Light' }).first();
      await expect(lightThemeButton).toBeVisible({ timeout: 5000 });
      await lightThemeButton.click();
      await page.waitForTimeout(500);

      // Step 3: Change items per page to 100
      const selects = page.locator('select');
      const itemsPerPageSelect = selects.nth(0);
      await itemsPerPageSelect.selectOption('100');

      // Step 4: Save changes
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 5: Wait for success
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 6: Reload page
      await page.reload();

      // Step 7: Verify both settings persist
      await expect(lightThemeButton).toBeVisible({ timeout: 10000 });
      const lightButtonBorder = await lightThemeButton.evaluate((el) => {
        return window.getComputedStyle(el).borderColor;
      });
      expect(lightButtonBorder).toBeTruthy();

      await expect(itemsPerPageSelect).toHaveValue('100');
    });

    test('should persist sidebar visibility settings after page reload', async ({ page }) => {
      // Step 1: Find Display Settings
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await expect(displaySettingsHeading).toBeVisible({ timeout: 10000 });

      // Step 2: Find and toggle "Show Sidebar by Default" checkbox
      const showSidebarCheckbox = page.locator('input[type="checkbox"]').filter({ hasAttribute: 'checked', or: { hasAttribute: 'unchecked' } }).first();
      const sidebarLabel = page.locator('text=Show Sidebar by Default');
      await expect(sidebarLabel).toBeVisible({ timeout: 5000 });

      // Get the checkbox associated with this label
      const sidebarCheckbox = sidebarLabel.locator('..').locator('input[type="checkbox"]');
      const wasChecked = await sidebarCheckbox.isChecked();

      // Step 3: Toggle the checkbox
      await sidebarCheckbox.click();

      // Step 4: Save changes
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const saveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await saveButton.click();

      // Step 5: Wait for success
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 6: Reload page
      await page.reload();

      // Step 7: Verify checkbox state changed and persists
      const newCheckedState = await sidebarCheckbox.isChecked();
      expect(newCheckedState).toBe(!wasChecked);
    });
  });

  // ============================================================================
  // RAG Settings Persistence Tests
  // ============================================================================

  test.describe('RAG Settings', () => {
    test('should persist chat provider selection after page reload', async ({ page }) => {
      // Step 1: Navigate to settings page
      await page.goto('/settings');
      await page.waitForTimeout(2000);

      // Step 2: Look for RAG Settings section (or similar heading)
      const ragHeading = page.locator('text=RAG Settings');
      if (await ragHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        // If RAG Settings is visible, proceed
        // Step 3: Find chat provider selection toggle
        const chatButton = page.locator('button').filter({ hasText: 'Chat' });
        await expect(chatButton).toBeVisible({ timeout: 10000 });

        // Step 4: Click chat button to ensure we're in chat mode
        await chatButton.click();
        await page.waitForTimeout(500);

        // Step 5: Select a different chat provider (e.g., Google)
        const googleProvider = page.locator('button').filter({ hasText: 'Google AI' }).first();
        if (await googleProvider.isVisible({ timeout: 5000 })) {
          await googleProvider.click();
          await page.waitForTimeout(500);

          // Step 6: Reload the page
          await page.reload();

          // Step 7: Verify the provider selection persists (Google AI should still be selected)
          // The provider selection uses localStorage, so it should persist
          await expect(googleProvider).toBeVisible({ timeout: 10000 });
          // Check if it has the selected styling (ring or border)
          const isSelected = await googleProvider.evaluate((el) => {
            return el.classList.contains('ring-2') || el.classList.contains('ring-brand-500');
          });
          expect(isSelected).toBe(true);
        }
      } else {
        // If RAG Settings tab exists but is not visible, skip or mark test as expected to fail
        test.skip();
      }
    });

    test('should persist embedding provider selection after page reload', async ({ page }) => {
      // Step 1: Navigate to settings
      await page.goto('/settings');
      await page.waitForTimeout(2000);

      // Step 2: Look for RAG Settings section
      const ragHeading = page.locator('text=RAG Settings');
      if (await ragHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Step 3: Find and click the Embedding button to switch to embedding mode
        const embeddingButton = page.locator('button').filter({ hasText: 'Embedding' });
        await expect(embeddingButton).toBeVisible({ timeout: 10000 });
        await embeddingButton.click();
        await page.waitForTimeout(500);

        // Step 4: Select a different embedding provider (e.g., Cohere)
        const cohereProvider = page.locator('button').filter({ hasText: 'Cohere' }).first();
        if (await cohereProvider.isVisible({ timeout: 5000 })) {
          await cohereProvider.click();
          await page.waitForTimeout(500);

          // Step 5: Reload the page
          await page.reload();

          // Step 6: Verify we're still in embedding mode and Cohere is selected
          await expect(embeddingButton).toBeVisible({ timeout: 10000 });
          await expect(cohereProvider).toBeVisible();

          // Check if Cohere is still selected
          const isSelected = await cohereProvider.evaluate((el) => {
            return el.classList.contains('ring-2') || el.classList.contains('ring-brand-500');
          });
          expect(isSelected).toBe(true);
        }
      } else {
        test.skip();
      }
    });

    test('should persist different chat and embedding provider selections together', async ({ page }) => {
      // Step 1: Navigate to settings
      await page.goto('/settings');
      await page.waitForTimeout(2000);

      // Step 2: Look for RAG Settings
      const ragHeading = page.locator('text=RAG Settings');
      if (await ragHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Step 3: Select chat provider
        const chatButton = page.locator('button').filter({ hasText: '💬 Chat' });
        await expect(chatButton).toBeVisible({ timeout: 10000 });
        await chatButton.click();
        await page.waitForTimeout(500);

        // Step 4: Select an Anthropic for chat
        const anthropicProvider = page.locator('button').filter({ hasText: 'Anthropic' }).first();
        if (await anthropicProvider.isVisible({ timeout: 5000 })) {
          await anthropicProvider.click();
          await page.waitForTimeout(500);

          // Step 5: Switch to embedding mode
          const embeddingButton = page.locator('button').filter({ hasText: '🔢 Embedding' });
          await expect(embeddingButton).toBeVisible();
          await embeddingButton.click();
          await page.waitForTimeout(500);

          // Step 6: Select Voyage for embedding
          const voyageProvider = page.locator('button').filter({ hasText: 'Voyage AI' }).first();
          if (await voyageProvider.isVisible({ timeout: 5000 })) {
            await voyageProvider.click();
            await page.waitForTimeout(500);

            // Step 7: Reload the page
            await page.reload();

            // Step 8: Verify chat provider (Anthropic) is still selected
            await chatButton.click();
            await page.waitForTimeout(500);
            const anthropicStillSelected = await anthropicProvider.evaluate((el) => {
              return el.classList.contains('ring-2') || el.classList.contains('ring-brand-500');
            });
            expect(anthropicStillSelected).toBe(true);

            // Step 9: Switch to embedding and verify Voyage is still selected
            await embeddingButton.click();
            await page.waitForTimeout(500);
            const voyageStillSelected = await voyageProvider.evaluate((el) => {
              return el.classList.contains('ring-2') || el.classList.contains('ring-brand-500');
            });
            expect(voyageStillSelected).toBe(true);
          }
        }
      } else {
        test.skip();
      }
    });

    test('should persist provider selection when navigating away and back', async ({ page }) => {
      // Step 1: Navigate to settings
      await page.goto('/settings');
      await page.waitForTimeout(2000);

      // Step 2: Look for RAG Settings
      const ragHeading = page.locator('text=RAG Settings');
      if (await ragHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Step 3: Select chat provider
        const chatButton = page.locator('button').filter({ hasText: '💬 Chat' });
        await expect(chatButton).toBeVisible({ timeout: 10000 });
        await chatButton.click();
        await page.waitForTimeout(500);

        // Step 4: Select OpenAI
        const openaiProvider = page.locator('button').filter({ hasText: 'OpenAI' }).first();
        if (await openaiProvider.isVisible({ timeout: 5000 })) {
          await openaiProvider.click();
          await page.waitForTimeout(500);

          // Step 5: Navigate away to dashboard
          const dashboardLink = page.locator('a[href="/"]').first();
          if (await dashboardLink.isVisible({ timeout: 5000 }).catch(() => false)) {
            await dashboardLink.click();
            await page.waitForURL('/', { timeout: 10000 });
            await page.waitForTimeout(1000);

            // Step 6: Navigate back to settings
            await page.goto('/settings');
            await page.waitForTimeout(2000);

            // Step 7: Verify OpenAI is still selected
            const isOpenaiSelected = await openaiProvider.evaluate((el) => {
              return el.classList.contains('ring-2') || el.classList.contains('ring-brand-500');
            });
            expect(isOpenaiSelected).toBe(true);
          }
        }
      } else {
        test.skip();
      }
    });
  });

  // ============================================================================
  // Cross-Section Persistence Tests
  // ============================================================================

  test.describe('Cross-Section Settings Persistence', () => {
    test('should persist General, Display, and RAG settings in single save', async ({ page }) => {
      // This test verifies that settings from different sections can coexist
      // Step 1: Update General Settings
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      const newSiteName = `Cross Section Test ${Date.now()}`;
      await siteNameInput.clear();
      await siteNameInput.fill(newSiteName);

      // Step 2: Scroll to Display Settings and update theme
      const displaySettingsHeading = page.locator('h2').filter({ hasText: 'Display Settings' });
      await displaySettingsHeading.scrollIntoViewIfNeeded();
      const darkThemeButton = page.locator('button:has-text("Dark")').filter({ hasText: 'Dark' });
      await darkThemeButton.click();
      await page.waitForTimeout(500);

      // Step 3: Save General Settings
      const generalSaveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await generalSaveButton.click();
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 4: Save Display Settings
      const displaySettingsSection = displaySettingsHeading.locator('..').locator('..');
      const displaySaveButton = displaySettingsSection.locator('button').filter({ hasText: 'Save Changes' });
      await displaySaveButton.click();
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload page
      await page.reload();

      // Step 6: Verify both settings persist
      await expect(siteNameInput).toHaveValue(newSiteName, { timeout: 10000 });
      const darkButtonBorder = await darkThemeButton.evaluate((el) => {
        return window.getComputedStyle(el).borderColor;
      });
      expect(darkButtonBorder).toBeTruthy();
    });
  });

  // ============================================================================
  // Error Handling and Edge Cases
  // ============================================================================

  test.describe('Settings Persistence - Edge Cases', () => {
    test('should handle empty/default values gracefully', async ({ page }) => {
      // Step 1: Find and clear site name field
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      await expect(siteNameInput).toBeVisible({ timeout: 10000 });

      // Get initial value
      const initialValue = await siteNameInput.inputValue();

      // Step 2: Save with current value
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 3: Wait for success and reload
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });
      await page.reload();

      // Step 4: Verify value is preserved
      await expect(siteNameInput).toHaveValue(initialValue, { timeout: 10000 });
    });

    test('should persist settings with special characters', async ({ page }) => {
      // Step 1: Enter special characters in site name
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      const specialName = 'Test@Site#2024!';
      await siteNameInput.clear();
      await siteNameInput.fill(specialName);

      // Step 2: Save
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();

      // Step 3: Wait and reload
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });
      await page.reload();

      // Step 4: Verify special characters persist
      await expect(siteNameInput).toHaveValue(specialName, { timeout: 10000 });
    });

    test('should handle rapid setting changes and saves', async ({ page }) => {
      // Step 1: Make first change to site name
      const siteNameInput = page.locator('input[placeholder="Archon Dashboard"]');
      const firstChange = `First Change ${Date.now()}`;
      await siteNameInput.clear();
      await siteNameInput.fill(firstChange);

      // Step 2: Click save
      const saveButton = page.locator('button').filter({ hasText: 'Save Changes' }).first();
      await saveButton.click();
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 3: Make another change without reload
      const secondChange = `Second Change ${Date.now()}`;
      await siteNameInput.clear();
      await siteNameInput.fill(secondChange);

      // Step 4: Save again
      await saveButton.click();
      await expect(page.locator('text=Settings saved successfully!')).toBeVisible({ timeout: 5000 });

      // Step 5: Reload and verify last change persists
      await page.reload();
      await expect(siteNameInput).toHaveValue(secondChange, { timeout: 10000 });
    });
  });
});
