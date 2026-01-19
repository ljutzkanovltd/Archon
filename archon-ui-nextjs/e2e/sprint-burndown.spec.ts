import { test, expect } from '@playwright/test';

/**
 * E2E Tests - Sprint Burndown Chart
 *
 * Phase 3.17: Test burndown chart accuracy
 *
 * Tests:
 * - Sprint report page loads correctly
 * - Burndown chart displays with correct data points
 * - Velocity chart shows historical data
 * - Sprint summary shows accurate stats
 * - Real-time updates work (for active sprints)
 * - Export functionality works
 */

test.describe('Sprint Burndown Chart', () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3738';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8181';

  let projectId: string;
  let sprintId: string;
  let taskIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Create test project
    const projectResponse = await request.post(`${apiUrl}/api/projects`, {
      data: {
        title: 'E2E Sprint Analytics Project',
        description: 'Test project for burndown chart',
      },
    });
    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    projectId = projectData.project.id;

    // Create test sprint
    const sprintResponse = await request.post(`${apiUrl}/api/sprints`, {
      data: {
        project_id: projectId,
        name: 'E2E Test Sprint',
        goal: 'Test sprint analytics',
        start_date: '2024-01-15',
        end_date: '2024-01-29',
        status: 'active',
      },
    });
    expect(sprintResponse.ok()).toBeTruthy();
    const sprintData = await sprintResponse.json();
    sprintId = sprintData.sprint.id;

    // Create test tasks
    const tasks = [
      { title: 'Task 1', status: 'done', priority: 'high' },
      { title: 'Task 2', status: 'done', priority: 'medium' },
      { title: 'Task 3', status: 'doing', priority: 'medium' },
      { title: 'Task 4', status: 'todo', priority: 'low' },
      { title: 'Task 5', status: 'todo', priority: 'low' },
    ];

    for (const task of tasks) {
      const taskResponse = await request.post(`${apiUrl}/api/tasks`, {
        data: {
          project_id: projectId,
          sprint_id: sprintId,
          ...task,
        },
      });
      expect(taskResponse.ok()).toBeTruthy();
      const taskData = await taskResponse.json();
      taskIds.push(taskData.task.id);
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete test data
    for (const taskId of taskIds) {
      await request.delete(`${apiUrl}/api/tasks/${taskId}`);
    }
    if (sprintId) {
      await request.delete(`${apiUrl}/api/sprints/${sprintId}`);
    }
    if (projectId) {
      await request.delete(`${apiUrl}/api/projects/${projectId}`);
    }
  });

  test('should load sprint report page', async ({ page }) => {
    // Navigate to sprint report (via project sprints view)
    await page.goto(`${baseUrl}/projects/${projectId}`);
    await page.waitForSelector('h1');

    // Switch to sprints view
    const sprintsButton = page.locator('button:has-text("Sprints"), [aria-label*="Sprints"]').first();
    await sprintsButton.click();

    // Wait for sprint list
    await page.waitForSelector('text=E2E Test Sprint');

    // Click on sprint to view report
    const sprintCard = page.locator('text=E2E Test Sprint').first();
    await sprintCard.click();

    // Verify sprint report page loaded
    await page.waitForSelector('h1:has-text("E2E Test Sprint Report"), h1:has-text("E2E Test Sprint")');
    expect(await page.textContent('body')).toContain('Test sprint analytics');
  });

  test('should display sprint summary with correct stats', async ({ page }) => {
    // Direct navigation to report page (URL depends on routing setup)
    // For now, navigate via project page
    await page.goto(`${baseUrl}/projects/${projectId}`);
    await page.waitForSelector('h1');

    // Switch to sprints view and click sprint
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for summary stats
    await page.waitForSelector('text=Tasks Completed, text=Sprint 1, text=E2E Test Sprint');

    // Verify task completion stats (2 done out of 5 total)
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/2\s*\/\s*5/); // "2 / 5" tasks completed
  });

  test('should display burndown chart', async ({ page }) => {
    // Navigate to sprint report
    await page.goto(`${baseUrl}/projects/${projectId}`);
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for chart to render
    await page.waitForSelector('text=Burndown Chart, h3:has-text("Burndown")');

    // Verify chart elements exist
    const chartSection = page.locator('text=Burndown Chart').locator('..');
    await expect(chartSection).toBeVisible();

    // Check for chart legend items
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Ideal|Actual|Completed/);
  });

  test('should display velocity chart', async ({ page }) => {
    // Navigate to sprint report
    await page.goto(`${baseUrl}/projects/${projectId}`);
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for velocity chart
    await page.waitForSelector('text=Velocity Chart, h3:has-text("Velocity")');

    // Verify chart elements
    const chartSection = page.locator('text=Velocity Chart').locator('..');
    await expect(chartSection).toBeVisible();

    // Check for average velocity display
    const bodyText = await page.textContent('body');
    expect(bodyText).toMatch(/Avg Velocity|Average/);
  });

  test('should refresh data when clicking refresh button', async ({ page }) => {
    // Navigate to sprint report
    await page.goto(`${baseUrl}/projects/${projectId}`);
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for page to load
    await page.waitForSelector('h1');

    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), button[aria-label*="Refresh"]').first();
    await refreshButton.click();

    // Wait for success toast
    await page.waitForSelector('text=refreshed, text=Report refreshed');

    // Verify page still displays correctly
    expect(await page.textContent('body')).toContain('E2E Test Sprint');
  });

  test('should export sprint report', async ({ page }) => {
    // Navigate to sprint report
    await page.goto(`${baseUrl}/projects/${projectId}`);
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for page to load
    await page.waitForSelector('h1');

    // Setup download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    const exportButton = page.locator('button:has-text("Export"), button[aria-label*="Export"]').first();
    await exportButton.click();

    // Wait for download to start
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/sprint-report.*\.csv/);

    // Verify success toast
    await page.waitForSelector('text=exported, text=Report exported');
  });

  test('should show real-time updates for active sprint', async ({ page }) => {
    // Navigate to sprint report
    await page.goto(`${baseUrl}/projects/${projectId}`);
    const sprintsButton = page.locator('button[aria-label*="Sprints"], button:has-text("Sprints")').first();
    await sprintsButton.click();
    await page.waitForSelector('text=E2E Test Sprint');

    const sprintLink = page.locator('a:has-text("E2E Test Sprint"), button:has-text("E2E Test Sprint")').first();
    await sprintLink.click();

    // Wait for initial load
    await page.waitForSelector('h1');

    // Get initial stats
    const initialStats = await page.textContent('text=Tasks Completed');

    // Update a task via API (simulate real-time change)
    await page.request.put(`${apiUrl}/api/tasks/${taskIds[2]}`, {
      data: { status: 'done' },
    });

    // Wait for polling interval (60 seconds) or trigger refresh
    const refreshButton = page.locator('button:has-text("Refresh")').first();
    await refreshButton.click();

    // Wait for update
    await page.waitForTimeout(2000);

    // Verify stats changed (3 done instead of 2)
    const updatedStats = await page.textContent('body');
    expect(updatedStats).toMatch(/3\s*\/\s*5/); // Now 3 out of 5 completed
  });
});
