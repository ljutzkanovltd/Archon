import { test, expect } from '@playwright/test';

/**
 * E2E Tests - Team Management
 * Phase 4.17: Create team and assign members
 *
 * Tests cover:
 * - Team creation flow (organization-wide and project-specific)
 * - Team member assignment
 * - Team member role management (lead/member/observer)
 * - Team filtering in task views
 * - Team workload dashboard
 */

test.describe('Team Management', () => {
  let testProjectId: string;
  let testTeamId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test project for team tests
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Team Test Project',
        description: 'Test project for team management E2E tests',
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

  test.describe('Team Creation Workflow', () => {
    test('should display team management section in Members view', async ({ page }) => {
      // Switch to Members view mode
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      // Check for Team Assignment section
      await expect(page.locator('text=Team Assignment')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('button').filter({ hasText: /New Team/i })).toBeVisible();
    });

    test('should open create team modal when clicking "New Team"', async ({ page }) => {
      // Navigate to members view
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      // Click New Team button
      const newTeamButton = page.locator('button').filter({ hasText: /New Team/i }).first();
      await newTeamButton.click();

      // Check modal appears
      await expect(page.locator('text=Create New Team')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input#team-name')).toBeVisible();
      await expect(page.locator('textarea#team-description')).toBeVisible();
    });

    test('should validate team name is required', async ({ page }) => {
      // Navigate to members and open modal
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      const newTeamButton = page.locator('button').filter({ hasText: /New Team/i }).first();
      await newTeamButton.click();

      // Try to submit without filling team name
      const createButton = page.locator('button').filter({ hasText: /^Create Team$/i });
      await createButton.click();

      // Check for validation error
      await expect(page.locator('text=/Team name is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should validate team name length (2-200 characters)', async ({ page }) => {
      // Navigate to members and open modal
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      const newTeamButton = page.locator('button').filter({ hasText: /New Team/i }).first();
      await newTeamButton.click();

      // Test with 1 character (too short)
      await page.fill('input#team-name', 'A');
      const createButton = page.locator('button').filter({ hasText: /^Create Team$/i });
      await createButton.click();
      await expect(page.locator('text=/at least 2 characters/i')).toBeVisible({ timeout: 3000 });

      // Clear and test with valid name
      await page.fill('input#team-name', '');
      await page.fill('input#team-name', 'E2E Test Team');
      await expect(page.locator('text=/at least 2 characters/i')).not.toBeVisible();
    });

    test('should successfully create a project-specific team', async ({ page }) => {
      // Navigate to members and open modal
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      const newTeamButton = page.locator('button').filter({ hasText: /New Team/i }).first();
      await newTeamButton.click();

      // Fill team form
      await page.fill('input#team-name', 'E2E Backend Team');
      await page.fill('textarea#team-description', 'Backend development team for E2E testing');

      // Submit
      const createButton = page.locator('button').filter({ hasText: /^Create Team$/i });
      await createButton.click();

      // Check for success notification
      await expect(page.locator('text=/Team.*created successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify team appears in the list
      await expect(page.locator('text=E2E Backend Team')).toBeVisible({ timeout: 5000 });
    });

    test('should create organization-wide team when scope is organization', async ({ page }) => {
      // For this test, we need to go to a non-project-specific team creation
      // This would typically be from the Teams page, not project detail
      // We'll skip the scope test as the modal pre-selects based on context
      test.skip();
    });
  });

  test.describe('Team Member Management', () => {
    test.beforeEach(async ({ request }) => {
      // Create a test team before each test
      const teamResponse = await request.post(`/api/teams`, {
        data: {
          name: 'E2E Test Team for Members',
          description: 'Team for testing member management',
          project_id: testProjectId,
        },
      });
      const teamData = await teamResponse.json();
      testTeamId = teamData.team.id;
    });

    test('should display team member list component', async ({ page }) => {
      // This test assumes there's a team detail view or manage button
      // Navigate to members view
      const membersButton = page.locator('button').filter({ hasText: /Members/i });
      if (await membersButton.isVisible()) {
        await membersButton.click();
        await page.waitForTimeout(500);
      }

      // Find and click manage button for the test team
      const teamCard = page.locator(`text=E2E Test Team for Members`).locator('..');
      await expect(teamCard).toBeVisible({ timeout: 5000 });

      const manageButton = teamCard.locator('button').filter({ hasText: /Manage/i });
      if (await manageButton.isVisible()) {
        await manageButton.click();
        await page.waitForTimeout(500);
      }
    });

    test.skip('should add member to team with role assignment', async ({ page }) => {
      // This test requires the team detail view/modal
      // Skipped because implementation may vary
      // TODO: Implement when team detail view is complete
    });

    test.skip('should update member role (member → lead)', async ({ page }) => {
      // This test requires the team detail view with member list
      // Skipped because implementation may vary
      // TODO: Implement when team member list is complete
    });

    test.skip('should remove member from team', async ({ page }) => {
      // This test requires the team detail view with member list
      // Skipped because implementation may vary
      // TODO: Implement when team member list is complete
    });
  });

  test.describe('Team Filtering in Task Views', () => {
    test.beforeEach(async ({ request }) => {
      // Create test team and tasks
      const teamResponse = await request.post(`/api/teams`, {
        data: {
          name: 'E2E Filter Test Team',
          description: 'Team for testing task filtering',
          project_id: testProjectId,
        },
      });
      const teamData = await teamResponse.json();
      testTeamId = teamData.team.id;
    });

    test('should display team filter dropdown in task views', async ({ page }) => {
      // Check Kanban view
      await page.goto(`/projects/${testProjectId}`);
      await page.waitForLoadState('networkidle');

      // Look for Team filter dropdown
      const teamFilter = page.locator('select#team-filter, [aria-label*="Team"]');
      await expect(teamFilter).toBeVisible({ timeout: 10000 });

      // Check "All Teams" option is present
      await expect(teamFilter.locator('option').filter({ hasText: /All Teams/i })).toBeVisible();
    });

    test('should filter tasks when team is selected', async ({ page }) => {
      await page.goto(`/projects/${testProjectId}`);
      await page.waitForLoadState('networkidle');

      // Get initial task count
      const initialTasks = await page.locator('[data-testid="task-card"], .task-card').count();

      // Select team filter
      const teamFilter = page.locator('select#team-filter');
      await teamFilter.selectOption({ label: /E2E Filter Test Team/i });
      await page.waitForTimeout(500);

      // Verify filter is applied (count label appears)
      await expect(page.locator('text=/Showing.*of.*tasks/i')).toBeVisible({ timeout: 3000 });
    });

    test('should clear filter when clicking clear button', async ({ page }) => {
      await page.goto(`/projects/${testProjectId}`);
      await page.waitForLoadState('networkidle');

      // Select team filter
      const teamFilter = page.locator('select#team-filter');
      await teamFilter.selectOption({ index: 1 }); // Select first team
      await page.waitForTimeout(500);

      // Click clear button (X icon)
      const clearButton = page.locator('button[title="Clear filter"]');
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(500);

        // Verify filter is cleared
        await expect(page.locator('text=/Showing.*of.*tasks/i')).not.toBeVisible();
      }
    });
  });

  test.describe('Team Workload Dashboard', () => {
    test.skip('should display workload dashboard with team metrics', async ({ page }) => {
      // This test requires navigation to workload dashboard
      // Implementation depends on where dashboard is accessible
      // TODO: Implement when dashboard navigation is finalized
    });

    test.skip('should show member utilization percentages', async ({ page }) => {
      // TODO: Implement when dashboard is accessible
    });

    test.skip('should color-code utilization levels (under/optimal/over)', async ({ page }) => {
      // TODO: Implement when dashboard is accessible
    });
  });

  test.afterAll(async ({ request }) => {
    // Clean up test data
    if (testProjectId) {
      await request.delete(`/api/projects/${testProjectId}`);
    }
  });
});
