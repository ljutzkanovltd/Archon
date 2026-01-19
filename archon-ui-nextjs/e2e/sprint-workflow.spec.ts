import { test, expect } from '@playwright/test';

/**
 * E2E Tests - Sprint Workflow
 * Phase 1.20 & 1.21: Create sprint workflow and status transitions
 *
 * Tests cover:
 * - Sprint creation flow
 * - Sprint status transitions (planned → active → completed)
 * - Sprint detail view
 * - Sprint editing
 * - Sprint task assignment
 */

test.describe('Sprint Workflow', () => {
  let testProjectId: string;
  let testSprintId: string;

  test.beforeAll(async ({ request }) => {
    // Create a test project for sprint tests
    const projectResponse = await request.post('/api/projects', {
      data: {
        title: 'E2E Sprint Test Project',
        description: 'Test project for sprint workflow E2E tests',
      },
    });
    const projectData = await projectResponse.json();
    testProjectId = projectData.project.id;
  });

  test.beforeEach(async ({ page }) => {
    // Navigate to projects page and wait for load
    await page.goto(`/projects/${testProjectId}`);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Sprint Creation Workflow (Phase 1.20)', () => {
    test('should display "New Sprint" button', async ({ page }) => {
      // Navigate to sprints tab/section
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Check for New Sprint button
      const newSprintButton = page.locator('button').filter({ hasText: /New Sprint|Create Sprint/i });
      await expect(newSprintButton.first()).toBeVisible({ timeout: 10000 });
    });

    test('should open create sprint modal when clicking "New Sprint"', async ({ page }) => {
      // Navigate to sprints section if needed
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Click New Sprint button
      const newSprintButton = page.locator('button').filter({ hasText: /New Sprint|Create Sprint/i }).first();
      await newSprintButton.click();

      // Check modal appears
      await expect(page.locator('text=Create New Sprint')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input#sprint-name')).toBeVisible();
      await expect(page.locator('textarea#sprint-goal')).toBeVisible();
      await expect(page.locator('input#start-date')).toBeVisible();
      await expect(page.locator('input#end-date')).toBeVisible();
    });

    test('should validate required fields in sprint creation', async ({ page }) => {
      // Navigate to sprints and open modal
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      const newSprintButton = page.locator('button').filter({ hasText: /New Sprint|Create Sprint/i }).first();
      await newSprintButton.click();

      // Try to submit without filling required fields
      const createButton = page.locator('button').filter({ hasText: /^Create Sprint$/i });
      await createButton.click();

      // Check for validation errors
      await expect(page.locator('text=/Sprint name is required/i')).toBeVisible({ timeout: 3000 });
    });

    test('should successfully create a sprint with valid data', async ({ page }) => {
      // Navigate to sprints and open modal
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
        await page.waitForTimeout(500);
      }

      const newSprintButton = page.locator('button').filter({ hasText: /New Sprint|Create Sprint/i }).first();
      await newSprintButton.click();

      // Fill sprint form
      await page.fill('input#sprint-name', 'E2E Test Sprint 1');
      await page.fill('textarea#sprint-goal', 'Complete all sprint workflow tests');

      // Set dates (2 weeks from today)
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 14);

      await page.fill('input#start-date', today.toISOString().split('T')[0]);
      await page.fill('input#end-date', endDate.toISOString().split('T')[0]);

      // Submit form
      const createButton = page.locator('button').filter({ hasText: /^Create Sprint$/i });
      await createButton.click();

      // Check for success notification
      await expect(page.locator('text=/Sprint created successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify sprint appears in list
      await expect(page.locator('text=E2E Test Sprint 1')).toBeVisible({ timeout: 5000 });
    });

    test('should show sprint in "Planned Sprints" section', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Check for Planned Sprints section header
      await expect(page.locator('h3').filter({ hasText: 'Planned Sprints' })).toBeVisible({ timeout: 10000 });

      // Verify planned sprint status badge
      const sprintCard = page.locator('text=E2E Test Sprint 1').locator('..');
      await expect(sprintCard.locator('text=Planned')).toBeVisible();
    });

    test('should display sprint details correctly', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Find and check sprint card
      const sprintCard = page.locator('text=E2E Test Sprint 1').locator('..');

      // Verify sprint info is displayed
      await expect(sprintCard.locator('text=E2E Test Sprint 1')).toBeVisible();
      await expect(sprintCard.locator('text=Complete all sprint workflow tests')).toBeVisible();
      await expect(sprintCard.locator('text=/Planned/i')).toBeVisible();
    });
  });

  test.describe('Sprint Status Transitions (Phase 1.21)', () => {
    test('should show "Start Sprint" button for planned sprints', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Find planned sprint card
      const sprintCard = page.locator('text=E2E Test Sprint 1').locator('..');

      // Check for Start Sprint button
      await expect(sprintCard.locator('button').filter({ hasText: 'Start Sprint' })).toBeVisible({ timeout: 5000 });
    });

    test('should transition sprint from planned to active', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Click Start Sprint button
      const sprintCard = page.locator('text=E2E Test Sprint 1').locator('..');
      const startButton = sprintCard.locator('button').filter({ hasText: 'Start Sprint' });
      await startButton.click();

      // Confirm in dialog
      await expect(page.locator('text=/Are you sure you want to start this sprint/i')).toBeVisible({ timeout: 3000 });
      const confirmButton = page.locator('button').filter({ hasText: /^Start Sprint$/i }).last();
      await confirmButton.click();

      // Check for success notification
      await expect(page.locator('text=/Sprint started successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify sprint moved to Active Sprints section
      await expect(page.locator('h3').filter({ hasText: 'Active Sprints' })).toBeVisible({ timeout: 5000 });

      const activeSprintCard = page.locator('text=E2E Test Sprint 1').locator('..');
      await expect(activeSprintCard.locator('text=/Active/i')).toBeVisible();
    });

    test('should show "Complete Sprint" button for active sprints', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Find active sprint
      const activeSection = page.locator('h3').filter({ hasText: 'Active Sprints' }).locator('..');
      const sprintCard = activeSection.locator('text=E2E Test Sprint 1').locator('..');

      // Check for Complete Sprint button
      await expect(sprintCard.locator('button').filter({ hasText: 'Complete Sprint' })).toBeVisible({ timeout: 5000 });
    });

    test('should transition sprint from active to completed', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Click Complete Sprint button
      const activeSection = page.locator('h3').filter({ hasText: 'Active Sprints' }).locator('..');
      const sprintCard = activeSection.locator('text=E2E Test Sprint 1').locator('..');
      const completeButton = sprintCard.locator('button').filter({ hasText: 'Complete Sprint' });
      await completeButton.click();

      // Confirm in dialog
      await expect(page.locator('text=/Are you sure you want to complete this sprint/i')).toBeVisible({ timeout: 3000 });
      const confirmButton = page.locator('button').filter({ hasText: /^Complete Sprint$/i }).last();
      await confirmButton.click();

      // Check for success notification
      await expect(page.locator('text=/Sprint completed successfully/i')).toBeVisible({ timeout: 5000 });

      // Verify sprint moved to Completed Sprints section
      await expect(page.locator('h3').filter({ hasText: /Completed Sprints/i })).toBeVisible({ timeout: 5000 });

      const completedSprintCard = page.locator('text=E2E Test Sprint 1').locator('..');
      await expect(completedSprintCard.locator('text=/Completed/i')).toBeVisible();
    });

    test('should not show action buttons for completed sprints', async ({ page }) => {
      // Navigate to sprints
      const sprintsTab = page.locator('button, a').filter({ hasText: 'Sprints' });
      if (await sprintsTab.isVisible()) {
        await sprintsTab.click();
      }

      // Find completed sprint
      const completedSection = page.locator('h3').filter({ hasText: /Completed Sprints/i }).locator('..');
      const sprintCard = completedSection.locator('text=E2E Test Sprint 1').locator('..');

      // Verify no action buttons
      await expect(sprintCard.locator('button').filter({ hasText: 'Start Sprint' })).not.toBeVisible();
      await expect(sprintCard.locator('button').filter({ hasText: 'Complete Sprint' })).not.toBeVisible();
    });
  });

  test.describe('Sprint-Task Integration', () => {
    test('should show sprint selector in task creation modal', async ({ page }) => {
      // Navigate to tasks
      const tasksTab = page.locator('button, a').filter({ hasText: 'Tasks' });
      if (await tasksTab.isVisible()) {
        await tasksTab.click();
      }

      // Click Create Task button (if modal exists)
      const createTaskButton = page.locator('button').filter({ hasText: /New Task|Create Task/i }).first();
      if (await createTaskButton.isVisible({ timeout: 2000 })) {
        await createTaskButton.click();

        // Check for sprint selector
        await expect(page.locator('label').filter({ hasText: /Sprint/i })).toBeVisible({ timeout: 5000 });
        await expect(page.locator('select#sprint-selector')).toBeVisible();
      }
    });

    test('should allow assigning task to sprint during creation', async ({ page }) => {
      // Navigate to tasks
      const tasksTab = page.locator('button, a').filter({ hasText: 'Tasks' });
      if (await tasksTab.isVisible()) {
        await tasksTab.click();
      }

      const createTaskButton = page.locator('button').filter({ hasText: /New Task|Create Task/i }).first();
      if (await createTaskButton.isVisible({ timeout: 2000 })) {
        await createTaskButton.click();

        // Fill task details
        await page.fill('input#task-title', 'Sprint Task Test');
        await page.fill('textarea#task-description', 'Task for testing sprint assignment');

        // Select sprint
        const sprintSelector = page.locator('select#sprint-selector');
        await sprintSelector.selectOption({ label: /E2E Test Sprint/i });

        // Submit
        const submitButton = page.locator('button').filter({ hasText: /^Create Task$/i });
        await submitButton.click();

        // Verify success
        await expect(page.locator('text=/Task created successfully/i')).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete test project
    if (testProjectId) {
      await request.delete(`/api/projects/${testProjectId}`);
    }
  });
});
