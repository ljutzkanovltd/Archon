import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Complete Sprint Lifecycle
 *
 * Tests the entire sprint workflow from creation to completion:
 * 1. Create sprint
 * 2. Assign tasks to sprint
 * 3. Start sprint (planned → active)
 * 4. Move tasks through workflow stages
 * 5. Complete sprint (active → completed)
 * 6. Verify sprint metrics and burndown
 *
 * Prerequisites:
 * - Backend API running on localhost:8181
 * - Frontend running on localhost:3738
 */

test.describe("Complete Sprint Lifecycle", () => {
  let testProjectId: string;
  let testSprintId: string;
  let testTaskIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Create a test project
    const projectResponse = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "E2E Sprint Lifecycle Test Project",
          description: "Test project for complete sprint lifecycle E2E tests",
        },
      }
    );

    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    testProjectId = projectData.project.id;

    // Create test tasks for sprint
    const taskTitles = [
      "Implement user authentication",
      "Create dashboard UI",
      "Set up database schema",
      "Write API endpoints",
      "Add unit tests",
    ];

    for (const title of taskTitles) {
      const taskResponse = await request.post(
        "http://localhost:8181/api/tasks",
        {
          data: {
            project_id: testProjectId,
            title: title,
            status: "backlog",
            story_points: 5,
          },
        }
      );

      if (taskResponse.ok()) {
        const task = await taskResponse.json();
        testTaskIds.push(task.task.id);
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete test tasks
    for (const taskId of testTaskIds) {
      await request.delete(`http://localhost:8181/api/tasks/${taskId}`);
    }

    // Delete sprint
    if (testSprintId) {
      await request.delete(`http://localhost:8181/api/sprints/${testSprintId}`);
    }

    // Delete test project
    if (testProjectId) {
      await request.delete(
        `http://localhost:8181/api/projects/${testProjectId}`
      );
    }
  });

  test("Step 1: Create a new sprint", async ({ page }) => {
    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=sprints`);

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Click "New Sprint" button
    const newSprintButton = page
      .locator("button")
      .filter({ hasText: /New Sprint|Create Sprint/i })
      .first();
    await expect(newSprintButton).toBeVisible({ timeout: 10000 });
    await newSprintButton.click();

    // Verify modal opened
    await expect(
      page.locator("text=Create New Sprint")
    ).toBeVisible({ timeout: 5000 });

    // Fill sprint details
    await page.fill("input#sprint-name", "E2E Lifecycle Sprint");
    await page.fill(
      "textarea#sprint-goal",
      "Test complete sprint lifecycle from creation to completion"
    );

    // Set dates (2 weeks from now)
    const today = new Date();
    const startDate = today.toISOString().split("T")[0];
    const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    await page.fill("input#start-date", startDate);
    await page.fill("input#end-date", endDate);

    // Submit sprint creation
    const createButton = page
      .locator("button")
      .filter({ hasText: /^Create Sprint$/i });
    await createButton.click();

    // Wait for success notification
    await expect(
      page.locator("text=/Sprint created successfully/i")
    ).toBeVisible({ timeout: 10000 });

    // Verify sprint appears in list
    await expect(page.locator("text=E2E Lifecycle Sprint")).toBeVisible({
      timeout: 5000,
    });

    // Verify initial status is "planned"
    const sprintCard = page.locator("text=E2E Lifecycle Sprint").locator("..");
    await expect(sprintCard.locator("text=/Planned/i")).toBeVisible();

    // Get sprint ID from URL or page
    await page.waitForTimeout(1000);
  });

  test("Step 2: Assign tasks to sprint", async ({ page, request }) => {
    // First, get the sprint ID via API
    const sprintsResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}/sprints`
    );
    const sprintsData = await sprintsResponse.json();
    const sprint = sprintsData.sprints.find(
      (s: any) => s.name === "E2E Lifecycle Sprint"
    );
    testSprintId = sprint.id;

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=sprints`);
    await page.waitForLoadState("networkidle");

    // Click on sprint to view details
    await page.locator("text=E2E Lifecycle Sprint").click();

    // Wait for sprint detail page/modal
    await page.waitForTimeout(1000);

    // For each test task, assign to sprint via API (faster than UI)
    for (const taskId of testTaskIds.slice(0, 3)) {
      // Assign first 3 tasks
      await request.put(`http://localhost:8181/api/tasks/${taskId}`, {
        data: {
          sprint_id: testSprintId,
        },
      });
    }

    // Refresh page to see updated task count
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify task count on sprint card/detail
    await expect(page.locator("text=/3.*task/i")).toBeVisible({ timeout: 5000 });
  });

  test("Step 3: Start sprint (planned → active)", async ({ page }) => {
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    // Click on sprint
    await page.locator("text=E2E Lifecycle Sprint").click();
    await page.waitForTimeout(500);

    // Click "Start Sprint" button
    const startButton = page.locator("button").filter({ hasText: /Start Sprint/i });
    await expect(startButton).toBeVisible({ timeout: 5000 });
    await startButton.click();

    // Confirm in modal if needed
    const confirmButton = page.locator("button").filter({ hasText: /Confirm|Yes/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    // Wait for status change notification
    await expect(
      page.locator("text=/Sprint started|Sprint is now active/i")
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to "active"
    await page.reload();
    await page.waitForLoadState("networkidle");

    const sprintCard = page.locator("text=E2E Lifecycle Sprint").locator("..");
    await expect(sprintCard.locator("text=/Active/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Step 4: Move tasks through workflow stages", async ({ page, request }) => {
    // Move tasks through stages via API for speed
    // Task 1: backlog → in_progress
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[0]}`, {
      data: {
        status: "in_progress",
      },
    });

    // Task 2: backlog → in_progress → review
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[1]}`, {
      data: {
        status: "in_progress",
      },
    });
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[1]}`, {
      data: {
        status: "review",
      },
    });

    // Task 3: backlog → in_progress → review → done
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[2]}`, {
      data: {
        status: "in_progress",
      },
    });
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[2]}`, {
      data: {
        status: "review",
      },
    });
    await request.put(`http://localhost:8181/api/tasks/${testTaskIds[2]}`, {
      data: {
        status: "done",
      },
    });

    // Navigate to sprint board view
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=board&sprint=${testSprintId}`
    );
    await page.waitForLoadState("networkidle");

    // Verify tasks appear in correct columns
    await expect(page.locator("text=Implement user authentication")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator("text=Create dashboard UI")).toBeVisible();
    await expect(page.locator("text=Set up database schema")).toBeVisible();

    // Verify burndown chart shows progress
    const burndownTab = page.locator("button, a").filter({ hasText: /Burndown/i });
    if (await burndownTab.isVisible({ timeout: 2000 })) {
      await burndownTab.click();
      await page.waitForTimeout(500);

      // Check for chart element
      await expect(
        page.locator("canvas, svg").filter({ hasText: /Burndown/i }).or(
          page.locator("text=/Remaining.*Point/i")
        )
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("Step 5: Complete remaining tasks", async ({ request }) => {
    // Complete remaining tasks via API
    for (const taskId of testTaskIds.slice(0, 3)) {
      await request.put(`http://localhost:8181/api/tasks/${taskId}`, {
        data: {
          status: "done",
        },
      });
    }
  });

  test("Step 6: Complete sprint (active → completed)", async ({ page }) => {
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    // Click on sprint
    await page.locator("text=E2E Lifecycle Sprint").click();
    await page.waitForTimeout(500);

    // Click "Complete Sprint" button
    const completeButton = page
      .locator("button")
      .filter({ hasText: /Complete Sprint|End Sprint/i });
    await expect(completeButton).toBeVisible({ timeout: 5000 });
    await completeButton.click();

    // Confirm in modal if needed
    const confirmButton = page.locator("button").filter({ hasText: /Confirm|Yes/i });
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
    }

    // Wait for completion notification
    await expect(
      page.locator("text=/Sprint completed|Sprint has ended/i")
    ).toBeVisible({ timeout: 10000 });

    // Verify status changed to "completed"
    await page.reload();
    await page.waitForLoadState("networkidle");

    const sprintCard = page.locator("text=E2E Lifecycle Sprint").locator("..");
    await expect(sprintCard.locator("text=/Completed/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Step 7: Verify sprint metrics", async ({ page, request }) => {
    // Get sprint report via API
    const reportResponse = await request.get(
      `http://localhost:8181/api/sprints/${testSprintId}/report?project_id=${testProjectId}`
    );

    if (reportResponse.ok()) {
      const reportData = await reportResponse.json();

      // Verify metrics
      expect(reportData.metrics.total_tasks).toBeGreaterThanOrEqual(3);
      expect(reportData.metrics.completed_tasks).toBe(3);
      expect(reportData.metrics.completion_rate).toBeGreaterThanOrEqual(90);
    }

    // Navigate to sprint detail page
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    await page.locator("text=E2E Lifecycle Sprint").click();
    await page.waitForTimeout(500);

    // Verify completion metrics displayed
    await expect(page.locator("text=/100%|Complete/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("Step 8: Verify burndown chart data", async ({ page }) => {
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    await page.locator("text=E2E Lifecycle Sprint").click();
    await page.waitForTimeout(500);

    // Navigate to burndown tab
    const burndownTab = page.locator("button, a").filter({ hasText: /Burndown/i });
    if (await burndownTab.isVisible({ timeout: 2000 })) {
      await burndownTab.click();
      await page.waitForTimeout(1000);

      // Verify burndown chart shows completed state
      // Chart should show all story points completed
      await expect(
        page.locator("text=/0.*remaining|All tasks completed/i")
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("Step 9: Verify sprint is read-only after completion", async ({ page }) => {
    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    await page.locator("text=E2E Lifecycle Sprint").click();
    await page.waitForTimeout(500);

    // Verify no "Start Sprint" or "Complete Sprint" buttons
    const startButton = page.locator("button").filter({ hasText: /Start Sprint/i });
    await expect(startButton).not.toBeVisible({ timeout: 2000 });

    const completeButton = page
      .locator("button")
      .filter({ hasText: /Complete Sprint/i });
    await expect(completeButton).not.toBeVisible({ timeout: 2000 });

    // Verify edit button is disabled or not present for sprint modifications
    // (Specific implementation may vary)
  });
});
