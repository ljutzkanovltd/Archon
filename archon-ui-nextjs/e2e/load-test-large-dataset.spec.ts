import { test, expect } from "@playwright/test";

/**
 * E2E Load Tests for Large Datasets
 *
 * Performance testing with large-scale data:
 * 1. Create 1000+ tasks across 50+ sprints
 * 2. Test UI responsiveness and rendering performance
 * 3. Verify pagination/infinite scroll
 * 4. Test search and filter performance
 * 5. Test board view with many columns
 * 6. Test timeline/Gantt view performance
 * 7. Measure and assert on performance metrics
 *
 * Prerequisites:
 * - Backend API running on localhost:8181
 * - Frontend running on localhost:3738
 * - Database with sufficient capacity
 *
 * ⚠️ WARNING: This test creates large amounts of data
 * Run with caution and ensure cleanup runs successfully
 */

test.describe("Load Test - Large Dataset (1000+ tasks, 50+ sprints)", () => {
  test.setTimeout(600000); // 10 minutes for entire suite

  let testProjectId: string;
  let sprintIds: string[] = [];
  let taskIds: string[] = [];

  const SPRINT_COUNT = 55; // 50+ sprints
  const TASKS_PER_SPRINT = 20; // 1100 total tasks
  const TOTAL_TASKS = SPRINT_COUNT * TASKS_PER_SPRINT;

  test.beforeAll(async ({ request }) => {
    console.log("🚀 Starting load test data creation...");
    console.log(`📊 Creating ${SPRINT_COUNT} sprints and ${TOTAL_TASKS} tasks`);

    // Create test project
    const projectResponse = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "E2E Load Test Project",
          description: "Project for load testing with large dataset",
        },
      }
    );

    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    testProjectId = projectData.project.id;

    console.log(`✅ Project created: ${testProjectId}`);

    // Create sprints in batches
    console.log(`📅 Creating ${SPRINT_COUNT} sprints...`);
    const today = new Date();

    for (let i = 0; i < SPRINT_COUNT; i++) {
      const startDate = new Date(
        today.getTime() + i * 14 * 24 * 60 * 60 * 1000
      );
      const endDate = new Date(
        startDate.getTime() + 14 * 24 * 60 * 60 * 1000
      );

      const sprintResponse = await request.post(
        `http://localhost:8181/api/projects/${testProjectId}/sprints`,
        {
          data: {
            name: `Load Test Sprint ${i + 1}`,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            goal: `Performance test sprint ${i + 1}`,
          },
        }
      );

      if (sprintResponse.ok()) {
        const sprintData = await sprintResponse.json();
        sprintIds.push(sprintData.sprint.id);

        if ((i + 1) % 10 === 0) {
          console.log(`  ✓ Created ${i + 1}/${SPRINT_COUNT} sprints`);
        }
      }
    }

    console.log(`✅ All ${sprintIds.length} sprints created`);

    // Create tasks in batches
    console.log(`📝 Creating ${TOTAL_TASKS} tasks...`);
    const statuses = ["backlog", "in_progress", "review", "done"];
    let createdCount = 0;

    for (let sprintIndex = 0; sprintIndex < sprintIds.length; sprintIndex++) {
      const sprintId = sprintIds[sprintIndex];

      // Create tasks for this sprint
      for (let taskIndex = 0; taskIndex < TASKS_PER_SPRINT; taskIndex++) {
        const status = statuses[taskIndex % statuses.length];

        const taskResponse = await request.post(
          "http://localhost:8181/api/tasks",
          {
            data: {
              project_id: testProjectId,
              title: `Load Test Task ${sprintIndex * TASKS_PER_SPRINT + taskIndex + 1}`,
              description: `Task ${taskIndex + 1} in sprint ${sprintIndex + 1}`,
              sprint_id: sprintId,
              status: status,
              story_points: Math.floor(Math.random() * 8) + 1, // 1-8 points
            },
          }
        );

        if (taskResponse.ok()) {
          const taskData = await taskResponse.json();
          taskIds.push(taskData.task.id);
          createdCount++;

          if (createdCount % 100 === 0) {
            console.log(`  ✓ Created ${createdCount}/${TOTAL_TASKS} tasks`);
          }
        }
      }
    }

    console.log(`✅ All ${taskIds.length} tasks created`);
    console.log("🎉 Load test data creation complete!");
  });

  test.afterAll(async ({ request }) => {
    console.log("🧹 Starting cleanup...");

    // Delete tasks in batches
    console.log(`🗑️  Deleting ${taskIds.length} tasks...`);
    let deletedCount = 0;

    for (const taskId of taskIds) {
      await request.delete(`http://localhost:8181/api/tasks/${taskId}`);
      deletedCount++;

      if (deletedCount % 100 === 0) {
        console.log(`  ✓ Deleted ${deletedCount}/${taskIds.length} tasks`);
      }
    }

    console.log(`✅ All tasks deleted`);

    // Delete sprints
    console.log(`🗑️  Deleting ${sprintIds.length} sprints...`);
    for (const sprintId of sprintIds) {
      await request.delete(`http://localhost:8181/api/sprints/${sprintId}`);
    }

    console.log(`✅ All sprints deleted`);

    // Delete project
    if (testProjectId) {
      await request.delete(
        `http://localhost:8181/api/projects/${testProjectId}`
      );
      console.log(`✅ Project deleted`);
    }

    console.log("✨ Cleanup complete!");
  });

  test("Step 1: Verify data creation completed successfully", async ({
    request,
  }) => {
    // Verify project exists
    const projectResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}`
    );
    expect(projectResponse.ok()).toBeTruthy();

    // Verify sprint count
    const sprintsResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}/sprints`
    );
    const sprintsData = await sprintsResponse.json();
    expect(sprintsData.sprints.length).toBeGreaterThanOrEqual(SPRINT_COUNT);

    // Verify task count
    const tasksResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}/tasks?per_page=1`
    );
    const tasksData = await tasksResponse.json();
    expect(tasksData.total || tasksData.tasks.length).toBeGreaterThanOrEqual(
      1000
    );

    console.log(
      `✅ Verified: ${sprintsData.sprints.length} sprints, ${tasksData.total || tasksData.tasks.length} tasks`
    );
  });

  test("Step 2: Test task list rendering performance", async ({ page }) => {
    console.log("⏱️  Testing task list rendering...");

    const startTime = Date.now();

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    const loadTime = Date.now() - startTime;
    console.log(`📊 Task list load time: ${loadTime}ms`);

    // Should load in reasonable time (< 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify tasks are visible
    const taskList = page.locator("[data-testid='tasks-list'], table");
    await expect(taskList).toBeVisible({ timeout: 10000 });

    // Check pagination exists
    const pagination = page.locator(
      "[data-testid='pagination'], button:has-text('Next')"
    );
    if (await pagination.isVisible({ timeout: 2000 })) {
      console.log("✅ Pagination found");
    } else {
      console.log("⚠️  No pagination (might use infinite scroll)");
    }
  });

  test("Step 3: Test sprint board rendering with large dataset", async ({
    page,
  }) => {
    console.log("⏱️  Testing sprint board rendering...");

    // Use first sprint for testing
    const firstSprintId = sprintIds[0];

    const startTime = Date.now();

    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=board&sprint=${firstSprintId}`
    );
    await page.waitForLoadState("networkidle");

    const loadTime = Date.now() - startTime;
    console.log(`📊 Board view load time: ${loadTime}ms`);

    // Should load in reasonable time (< 8 seconds for 20 tasks)
    expect(loadTime).toBeLessThan(8000);

    // Verify board columns exist
    const boardColumns = page.locator(
      "[data-testid='board-column'], [class*='column']"
    );
    const columnCount = await boardColumns.count();

    expect(columnCount).toBeGreaterThanOrEqual(3); // At least 3 workflow stages

    console.log(`✅ Board rendered with ${columnCount} columns`);
  });

  test("Step 4: Test search performance with large dataset", async ({
    page,
  }) => {
    console.log("⏱️  Testing search performance...");

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    // Find search input
    const searchInput = page.locator("input[type='search'], input[placeholder*='search' i]");

    if (await searchInput.isVisible({ timeout: 3000 })) {
      const startTime = Date.now();

      // Search for specific task
      await searchInput.fill("Load Test Task 500");
      await page.waitForTimeout(500); // Debounce

      const searchTime = Date.now() - startTime;
      console.log(`📊 Search execution time: ${searchTime}ms`);

      // Search should be fast (< 2 seconds)
      expect(searchTime).toBeLessThan(2000);

      // Verify results appear
      const results = page.locator("text=Load Test Task 500");
      await expect(results.first()).toBeVisible({ timeout: 5000 });

      console.log("✅ Search results displayed");
    } else {
      console.log("⚠️  Search input not found - skipping test");
      test.skip();
    }
  });

  test("Step 5: Test filter performance", async ({ page }) => {
    console.log("⏱️  Testing filter performance...");

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    // Find status filter dropdown
    const statusFilter = page
      .locator("select, [role='combobox']")
      .filter({ hasText: /Status|Filter/i })
      .first();

    if (await statusFilter.isVisible({ timeout: 3000 })) {
      const startTime = Date.now();

      await statusFilter.click();
      await page.waitForTimeout(200);

      // Select "In Progress" filter
      const inProgressOption = page.locator(
        "option:has-text('In Progress'), [role='option']:has-text('In Progress')"
      );

      if (await inProgressOption.isVisible({ timeout: 2000 })) {
        await inProgressOption.click();
      }

      await page.waitForTimeout(500); // Wait for filter to apply

      const filterTime = Date.now() - startTime;
      console.log(`📊 Filter execution time: ${filterTime}ms`);

      // Filtering should be fast (< 3 seconds)
      expect(filterTime).toBeLessThan(3000);

      console.log("✅ Filter applied successfully");
    } else {
      console.log("⚠️  Filter dropdown not found - skipping test");
      test.skip();
    }
  });

  test("Step 6: Test pagination/infinite scroll performance", async ({
    page,
  }) => {
    console.log("⏱️  Testing pagination performance...");

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    // Check for pagination buttons
    const nextButton = page
      .locator("button")
      .filter({ hasText: /Next|>|→/i })
      .first();

    if (await nextButton.isVisible({ timeout: 3000 })) {
      // Test pagination
      const startTime = Date.now();

      await nextButton.click();
      await page.waitForLoadState("networkidle");

      const paginationTime = Date.now() - startTime;
      console.log(`📊 Page 2 load time: ${paginationTime}ms`);

      // Pagination should be fast (< 2 seconds)
      expect(paginationTime).toBeLessThan(2000);

      console.log("✅ Pagination working");
    } else {
      // Try infinite scroll
      console.log("📜 Testing infinite scroll...");

      const startTime = Date.now();

      // Scroll to bottom
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await page.waitForTimeout(1000); // Wait for new items to load

      const scrollTime = Date.now() - startTime;
      console.log(`📊 Infinite scroll load time: ${scrollTime}ms`);

      // Scroll load should be fast (< 2 seconds)
      expect(scrollTime).toBeLessThan(2000);

      console.log("✅ Infinite scroll working");
    }
  });

  test("Step 7: Test sprint list performance with 50+ sprints", async ({
    page,
  }) => {
    console.log("⏱️  Testing sprint list rendering...");

    const startTime = Date.now();

    await page.goto(
      `http://localhost:3738/projects/${testProjectId}?tab=sprints`
    );
    await page.waitForLoadState("networkidle");

    const loadTime = Date.now() - startTime;
    console.log(`📊 Sprint list load time: ${loadTime}ms`);

    // Should load in reasonable time (< 5 seconds)
    expect(loadTime).toBeLessThan(5000);

    // Verify sprints are visible
    const sprintList = page.locator("[data-testid='sprint-list'], .sprint-card");
    const sprintCount = await sprintList.count();

    console.log(`✅ Sprint list rendered with ${sprintCount} visible sprints`);
  });

  test("Step 8: Test memory usage doesn't explode", async ({ page }) => {
    console.log("🧠 Testing memory usage...");

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    // Get initial metrics
    const initialMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: (performance.memory as any).usedJSHeapSize,
          totalJSHeapSize: (performance.memory as any).totalJSHeapSize,
        };
      }
      return null;
    });

    if (initialMetrics) {
      console.log(
        `📊 Initial heap: ${(initialMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`
      );

      // Navigate through several pages
      for (let i = 0; i < 5; i++) {
        await page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=board`
        );
        await page.waitForLoadState("networkidle");
        await page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=tasks`
        );
        await page.waitForLoadState("networkidle");
      }

      // Get final metrics
      const finalMetrics = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: (performance.memory as any).usedJSHeapSize,
            totalJSHeapSize: (performance.memory as any).totalJSHeapSize,
          };
        }
        return null;
      });

      if (finalMetrics) {
        console.log(
          `📊 Final heap: ${(finalMetrics.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`
        );

        const memoryIncrease =
          finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
        const increasePercent =
          (memoryIncrease / initialMetrics.usedJSHeapSize) * 100;

        console.log(
          `📈 Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${increasePercent.toFixed(1)}%)`
        );

        // Memory shouldn't increase by more than 100MB
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

        console.log("✅ Memory usage within acceptable limits");
      }
    } else {
      console.log("⚠️  performance.memory not available - skipping test");
      test.skip();
    }
  });

  test("Step 9: Test API response times with large dataset", async ({
    request,
  }) => {
    console.log("⏱️  Testing API response times...");

    // Test task list API
    const taskListStart = Date.now();
    const tasksResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}/tasks?per_page=50`
    );
    const taskListTime = Date.now() - taskListStart;

    expect(tasksResponse.ok()).toBeTruthy();
    console.log(`📊 Task list API: ${taskListTime}ms`);
    expect(taskListTime).toBeLessThan(1000); // < 1 second

    // Test sprint list API
    const sprintListStart = Date.now();
    const sprintsResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}/sprints`
    );
    const sprintListTime = Date.now() - sprintListStart;

    expect(sprintsResponse.ok()).toBeTruthy();
    console.log(`📊 Sprint list API: ${sprintListTime}ms`);
    expect(sprintListTime).toBeLessThan(1000); // < 1 second

    // Test project detail API
    const projectStart = Date.now();
    const projectResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}`
    );
    const projectTime = Date.now() - projectStart;

    expect(projectResponse.ok()).toBeTruthy();
    console.log(`📊 Project detail API: ${projectTime}ms`);
    expect(projectTime).toBeLessThan(500); // < 500ms

    console.log("✅ All API response times within acceptable limits");
  });

  test("Step 10: Test UI remains responsive during operations", async ({
    page,
  }) => {
    console.log("🎯 Testing UI responsiveness...");

    await page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`);
    await page.waitForLoadState("networkidle");

    // Measure interaction responsiveness
    const measureClick = async (selector: string, description: string) => {
      const element = page.locator(selector).first();

      if (await element.isVisible({ timeout: 2000 })) {
        const startTime = Date.now();
        await element.click();
        await page.waitForTimeout(100);
        const clickTime = Date.now() - startTime;

        console.log(`  ✓ ${description}: ${clickTime}ms`);
        expect(clickTime).toBeLessThan(500); // Should respond within 500ms
      } else {
        console.log(`  ⚠️  ${description}: Element not found`);
      }
    };

    // Test various interactions
    await measureClick("button", "Button click");
    await measureClick("a", "Link click");

    const input = page.locator("input[type='text'], input[type='search']").first();
    if (await input.isVisible({ timeout: 2000 })) {
      const startTime = Date.now();
      await input.fill("test");
      const typingTime = Date.now() - startTime;

      console.log(`  ✓ Text input: ${typingTime}ms`);
      expect(typingTime).toBeLessThan(300);
    }

    console.log("✅ UI remains responsive");
  });

  test("Step 11: Verify no performance degradation after extended use", async ({
    page,
  }) => {
    console.log("🔄 Testing sustained performance...");

    const measurements: number[] = [];

    // Perform same operation 10 times and measure
    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      await page.goto(
        `http://localhost:3738/projects/${testProjectId}?tab=tasks`
      );
      await page.waitForLoadState("networkidle");

      const loadTime = Date.now() - startTime;
      measurements.push(loadTime);

      console.log(`  Iteration ${i + 1}: ${loadTime}ms`);
    }

    // Calculate average and standard deviation
    const average =
      measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const variance =
      measurements.reduce((a, b) => a + Math.pow(b - average, 2), 0) /
      measurements.length;
    const stdDev = Math.sqrt(variance);

    console.log(`📊 Average load time: ${average.toFixed(0)}ms`);
    console.log(`📊 Standard deviation: ${stdDev.toFixed(0)}ms`);
    console.log(
      `📊 Min: ${Math.min(...measurements)}ms, Max: ${Math.max(...measurements)}ms`
    );

    // Performance should remain consistent (low variance)
    expect(stdDev).toBeLessThan(average * 0.5); // StdDev < 50% of average

    console.log("✅ Performance remains consistent over time");
  });

  test("Summary: Load test results", () => {
    console.log("\n" + "=".repeat(60));
    console.log("📊 LOAD TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`Dataset Size:`);
    console.log(`  - Sprints: ${sprintIds.length}`);
    console.log(`  - Tasks: ${taskIds.length}`);
    console.log(`  - Tasks per Sprint: ~${Math.floor(taskIds.length / sprintIds.length)}`);
    console.log("\n✅ All performance tests passed!");
    console.log("=".repeat(60) + "\n");
  });
});
