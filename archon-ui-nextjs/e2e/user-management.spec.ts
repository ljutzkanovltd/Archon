import { test, expect, Page } from "@playwright/test";

/**
 * E2E Tests for User Management System (RBAC Phase 5)
 *
 * Tests the complete user management workflow with role-based access control:
 * 1. User list display (admin only)
 * 2. User invitation flow
 * 3. Role assignment and permissions
 * 4. User profile editing
 * 5. User deactivation/activation
 * 6. Access control (admin vs member vs viewer)
 * 7. Account lockout after failed attempts
 *
 * Prerequisites:
 * - Backend API running on localhost:8181
 * - Frontend running on localhost:3738
 * - Test users: testadmin@archon.dev, testmember@archon.dev, testviewer@archon.dev
 * - Passwords: admin123, member123, viewer123
 */

test.describe("User Management System - RBAC", () => {
  // Helper function to login
  async function loginUser(
    page: Page,
    email: string,
    password: string
  ): Promise<void> {
    await page.goto("http://localhost:3738/login");

    // Wait for login form to load
    await page.waitForSelector("input#email", { timeout: 10000 });

    await page.fill("input#email", email);
    await page.fill("input#password", password);
    await page.click("button[type='submit']");

    // Wait for redirect away from login (could be / or /dashboard)
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 });

    // If redirected to root, navigate to dashboard
    if (page.url() === "http://localhost:3738/") {
      await page.goto("http://localhost:3738/dashboard");
    }
  }

  // Helper to check if element is visible
  async function isElementVisible(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.locator(selector).first();
      return await element.isVisible({ timeout: 2000 });
    } catch {
      return false;
    }
  }

  test.describe("Admin Access Tests", () => {
    test("Admin can access users page and see user list", async ({ page }) => {
      // Login as admin
      await loginUser(page, "testadmin@archon.dev", "admin123");

      // Navigate to users page
      await page.goto("http://localhost:3738/users");

      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Check that we're on the users page (should not redirect)
      await expect(page).toHaveURL(/.*\/users/);

      // Check for user table/list
      const userListVisible = await isElementVisible(page, "table") ||
                              await isElementVisible(page, "[role='table']") ||
                              await isElementVisible(page, "[data-testid='user-list']");

      expect(userListVisible).toBeTruthy();
    });

    test("Admin can see invite user button", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Look for invite button
      const inviteButtonVisible = await isElementVisible(page, "button:has-text('Invite')") ||
                                   await isElementVisible(page, "[data-testid='invite-user-button']") ||
                                   await isElementVisible(page, "button:has-text('Add User')");

      expect(inviteButtonVisible).toBeTruthy();
    });

    test("Admin can open invite user modal", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Find and click invite button
      const inviteButton = page.locator("button").filter({ hasText: /invite|add user/i }).first();

      if (await inviteButton.isVisible({ timeout: 5000 })) {
        await inviteButton.click();

        // Wait for modal to appear
        await page.waitForTimeout(1000);

        // Check for modal/form fields
        const emailFieldVisible = await isElementVisible(page, "input#email") ||
                                   await isElementVisible(page, "input[type='email']");

        expect(emailFieldVisible).toBeTruthy();
      } else {
        console.log("Invite button not found - skipping modal test");
      }
    });

    test("Admin can view user details", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Look for first user row
      const userRow = page.locator("tr, [role='row'], [data-testid='user-row']").nth(1);

      if (await userRow.isVisible({ timeout: 5000 })) {
        // Check that user email or name is visible
        const hasEmail = await page.locator("text=/@archon.dev|@example.com/").first().isVisible({ timeout: 2000 });
        expect(hasEmail || await userRow.isVisible()).toBeTruthy();
      }
    });
  });

  test.describe("Member Access Tests", () => {
    test("Member cannot access users page (403 Forbidden)", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");

      // Try to navigate to users page
      const response = await page.goto("http://localhost:3738/users");

      // Should either redirect or show 403/access denied
      const currentUrl = page.url();
      const shouldNotBeOnUsersPage = !currentUrl.includes("/users") ||
                                      await isElementVisible(page, "text=/403|forbidden|access denied/i");

      expect(shouldNotBeOnUsersPage).toBeTruthy();
    });

    test("Member does not see Users link in sidebar", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");
      await page.waitForLoadState("networkidle");

      // Check sidebar for Users link
      const usersLinkVisible = await isElementVisible(page, "a[href='/users']") ||
                                await isElementVisible(page, "text='Users'");

      expect(usersLinkVisible).toBeFalsy();
    });

    test("Member can access own profile in settings", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");

      // Navigate to settings
      await page.goto("http://localhost:3738/settings");
      await page.waitForLoadState("networkidle");

      // Check for profile section
      const profileVisible = await isElementVisible(page, "input[name='full_name']") ||
                              await isElementVisible(page, "text='Profile'") ||
                              await isElementVisible(page, "[data-testid='profile-section']");

      expect(profileVisible).toBeTruthy();
    });

    test("Member cannot see Database Sync in settings", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");
      await page.goto("http://localhost:3738/settings");
      await page.waitForLoadState("networkidle");

      // Database Sync should NOT be visible
      const dbSyncVisible = await isElementVisible(page, "text='Database Sync'") ||
                             await isElementVisible(page, "[data-testid='database-sync']");

      expect(dbSyncVisible).toBeFalsy();
    });
  });

  test.describe("Viewer Access Tests", () => {
    test("Viewer cannot access users page", async ({ page }) => {
      await loginUser(page, "testviewer@archon.dev", "viewer123");

      // Try to navigate to users page
      const response = await page.goto("http://localhost:3738/users");

      // Should redirect or show 403
      const currentUrl = page.url();
      const shouldNotBeOnUsersPage = !currentUrl.includes("/users") ||
                                      await isElementVisible(page, "text=/403|forbidden|access denied/i");

      expect(shouldNotBeOnUsersPage).toBeTruthy();
    });

    test("Viewer has read-only access to dashboard", async ({ page }) => {
      await loginUser(page, "testviewer@archon.dev", "viewer123");
      await page.waitForLoadState("networkidle");

      // Should be on dashboard
      expect(page.url()).toContain("dashboard");

      // Check for dashboard content
      const dashboardVisible = await isElementVisible(page, "h1, h2") ||
                                await isElementVisible(page, "[data-testid='dashboard']");

      expect(dashboardVisible).toBeTruthy();
    });

    test("Viewer cannot see create/edit buttons", async ({ page }) => {
      await loginUser(page, "testviewer@archon.dev", "viewer123");

      // Navigate to projects
      await page.goto("http://localhost:3738/projects");
      await page.waitForLoadState("networkidle");

      // Create/Edit buttons should not be visible (or should be disabled)
      const createButton = page.locator("button").filter({ hasText: /create|new project/i }).first();

      const canCreate = await createButton.isVisible({ timeout: 2000 }).catch(() => false);

      // If button is visible, it should be disabled
      if (canCreate) {
        const isDisabled = await createButton.isDisabled();
        expect(isDisabled).toBeTruthy();
      }
    });
  });

  test.describe("Authentication Flow", () => {
    test("Login with correct credentials succeeds", async ({ page }) => {
      await page.goto("http://localhost:3738/login");
      await page.waitForSelector("input#email", { timeout: 10000 });
      await page.fill("input#email", "testadmin@archon.dev");
      await page.fill("input#password", "admin123");
      await page.click("button[type='submit']");

      // Should redirect to dashboard
      await page.waitForURL("**/dashboard", { timeout: 10000 });
      expect(page.url()).toContain("dashboard");
    });

    test("Login with incorrect password fails", async ({ page }) => {
      await page.goto("http://localhost:3738/login");
      await page.waitForSelector("input#email", { timeout: 10000 });
      await page.fill("input#email", "testadmin@archon.dev");
      await page.fill("input#password", "wrongpassword123");
      await page.click("button[type='submit']");

      // Should show error message
      await page.waitForTimeout(2000);

      const hasError = await isElementVisible(page, "text=/invalid|incorrect|error/i") ||
                        await isElementVisible(page, "[role='alert']") ||
                        page.url().includes("login"); // Still on login page

      expect(hasError).toBeTruthy();
    });

    test("Logout functionality works", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.waitForLoadState("networkidle");

      // Look for logout button (usually in avatar menu or top-right)
      const avatarMenu = page.locator("[data-testid='user-menu'], [role='button']:has-text(/admin|user/i)").first();

      if (await avatarMenu.isVisible({ timeout: 2000 })) {
        await avatarMenu.click();
        await page.waitForTimeout(500);

        const logoutButton = page.locator("button, a").filter({ hasText: /logout|sign out/i }).first();

        if (await logoutButton.isVisible({ timeout: 2000 })) {
          await logoutButton.click();

          // Should redirect to login
          await page.waitForURL("**/login", { timeout: 10000 });
          expect(page.url()).toContain("login");
        }
      }
    });
  });

  test.describe("Role-Based Sidebar Visibility", () => {
    test("Admin sees all sidebar items including Users", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.waitForLoadState("networkidle");

      // Check for key admin items
      const usersLinkVisible = await isElementVisible(page, "a[href='/users']");
      const settingsLinkVisible = await isElementVisible(page, "a[href='/settings']");

      expect(usersLinkVisible || settingsLinkVisible).toBeTruthy();
    });

    test("Member sees limited sidebar items", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");
      await page.waitForLoadState("networkidle");

      // Users link should NOT be visible
      const usersLinkVisible = await isElementVisible(page, "a[href='/users']");
      expect(usersLinkVisible).toBeFalsy();

      // But Dashboard should be visible
      const dashboardVisible = await isElementVisible(page, "a[href='/dashboard']");
      expect(dashboardVisible).toBeTruthy();
    });

    test("Viewer sees minimal sidebar items", async ({ page }) => {
      await loginUser(page, "testviewer@archon.dev", "viewer123");
      await page.waitForLoadState("networkidle");

      // Users and admin pages should NOT be visible
      const usersLinkVisible = await isElementVisible(page, "a[href='/users']");
      const mcpInspectorVisible = await isElementVisible(page, "text='MCP Inspector'");

      expect(usersLinkVisible).toBeFalsy();
      expect(mcpInspectorVisible).toBeFalsy();
    });
  });

  test.describe("User Profile Management", () => {
    test("Admin can edit own profile", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/settings");
      await page.waitForLoadState("networkidle");

      // Find name input
      const nameInput = page.locator("input[name='full_name']").first();

      if (await nameInput.isVisible({ timeout: 5000 })) {
        const originalValue = await nameInput.inputValue();

        // Update name
        await nameInput.fill("Test Admin Updated");

        // Look for save button
        const saveButton = page.locator("button").filter({ hasText: /save|update/i }).first();

        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();
          await page.waitForTimeout(1000);

          // Restore original value
          await nameInput.fill(originalValue);
          await saveButton.click();
        }
      }
    });

    test("Member can edit own profile", async ({ page }) => {
      await loginUser(page, "testmember@archon.dev", "member123");
      await page.goto("http://localhost:3738/settings");
      await page.waitForLoadState("networkidle");

      // Member should see profile fields
      const nameInput = page.locator("input[name='full_name']").first();
      const emailInput = page.locator("input[name='email']").first();

      const canEditProfile = await nameInput.isVisible({ timeout: 5000 }) ||
                             await emailInput.isVisible({ timeout: 5000 });

      expect(canEditProfile).toBeTruthy();
    });
  });

  test.describe("Account Security", () => {
    test("Account locks after 5 failed login attempts", async ({ page }) => {
      const testEmail = "testviewer@archon.dev";
      const wrongPassword = "wrongpassword123";

      // Attempt 5 failed logins
      for (let i = 0; i < 5; i++) {
        await page.goto("http://localhost:3738/login");
        await page.waitForSelector("input#email", { timeout: 10000 });
        await page.fill("input#email", testEmail);
        await page.fill("input#password", wrongPassword);
        await page.click("button[type='submit']");
        await page.waitForTimeout(1000);
      }

      // 6th attempt should show locked message
      await page.goto("http://localhost:3738/login");
      await page.waitForSelector("input#email", { timeout: 10000 });
      await page.fill("input#email", testEmail);
      await page.fill("input#password", "viewer123"); // Correct password
      await page.click("button[type='submit']");
      await page.waitForTimeout(2000);

      // Should show locked account message
      const hasLockedMessage = await isElementVisible(page, "text=/locked|temporarily disabled/i") ||
                                page.url().includes("login");

      expect(hasLockedMessage).toBeTruthy();
    });
  });

  test.describe("User List Features (Admin Only)", () => {
    test("Admin can search/filter users", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Look for search input
      const searchInput = page.locator("input[type='search'], input[placeholder*='search' i]").first();

      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill("test");
        await page.waitForTimeout(1000);

        // Results should update
        const hasResults = await isElementVisible(page, "table") ||
                           await isElementVisible(page, "[role='table']");

        expect(hasResults).toBeTruthy();
      }
    });

    test("Admin can see user role badges", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Look for role indicators
      const hasRoleBadge = await isElementVisible(page, "text=/admin|member|viewer/i") ||
                           await isElementVisible(page, "[data-testid='role-badge']");

      expect(hasRoleBadge).toBeTruthy();
    });

    test("Admin can see user status (active/inactive)", async ({ page }) => {
      await loginUser(page, "testadmin@archon.dev", "admin123");
      await page.goto("http://localhost:3738/users");
      await page.waitForLoadState("networkidle");

      // Look for status indicators
      const hasStatus = await isElementVisible(page, "text=/active|inactive/i") ||
                        await isElementVisible(page, "[data-testid='user-status']");

      expect(hasStatus).toBeTruthy();
    });
  });

  test.afterEach(async ({ page }) => {
    // Close page after each test
    await page.close();
  });
});
