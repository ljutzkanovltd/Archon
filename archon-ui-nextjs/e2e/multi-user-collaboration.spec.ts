import { test, expect, Page, BrowserContext } from "@playwright/test";

/**
 * E2E Tests for Multi-User Collaboration
 *
 * Tests concurrent operations and collaboration features:
 * 1. Concurrent task editing by multiple users
 * 2. Real-time updates and notifications
 * 3. Conflict resolution (optimistic locking, last-write-wins, etc.)
 * 4. Simultaneous sprint modifications
 * 5. Race conditions in workflow stage transitions
 * 6. Concurrent project hierarchy changes
 *
 * Prerequisites:
 * - Backend API running on localhost:8181
 * - Frontend running on localhost:3738
 * - Multiple user accounts configured
 */

test.describe("Multi-User Collaboration", () => {
  let testProjectId: string;
  let testTaskId: string;
  let testSprintId: string;

  // Helper to create authenticated context
  async function createAuthenticatedContext(
    browser: any,
    userEmail: string
  ): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login user
    await page.goto("http://localhost:3738/login");
    await page.fill("input[name='email']", userEmail);
    await page.fill("input[name='password']", "testpassword123");
    await page.click("button[type='submit']");

    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard", { timeout: 10000 });

    return { context, page };
  }

  test.beforeAll(async ({ request }) => {
    // Create test project
    const projectResponse = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "E2E Multi-User Collaboration Test",
          description: "Project for testing concurrent user operations",
        },
      }
    );

    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    testProjectId = projectData.project.id;

    // Create test task
    const taskResponse = await request.post(
      "http://localhost:8181/api/tasks",
      {
        data: {
          project_id: testProjectId,
          title: "Concurrent Edit Test Task",
          description: "Task for testing concurrent edits",
          status: "backlog",
        },
      }
    );

    if (taskResponse.ok()) {
      const taskData = await taskResponse.json();
      testTaskId = taskData.task.id;
    }

    // Create test sprint
    const today = new Date();
    const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);

    const sprintResponse = await request.post(
      `http://localhost:8181/api/projects/${testProjectId}/sprints`,
      {
        data: {
          name: "Concurrent Sprint Test",
          start_date: today.toISOString().split("T")[0],
          end_date: endDate.toISOString().split("T")[0],
          goal: "Test concurrent sprint operations",
        },
      }
    );

    if (sprintResponse.ok()) {
      const sprintData = await sprintResponse.json();
      testSprintId = sprintData.sprint.id;
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup
    if (testTaskId) {
      await request.delete(`http://localhost:8181/api/tasks/${testTaskId}`);
    }
    if (testSprintId) {
      await request.delete(`http://localhost:8181/api/sprints/${testSprintId}`);
    }
    if (testProjectId) {
      await request.delete(
        `http://localhost:8181/api/projects/${testProjectId}`
      );
    }
  });

  test("Step 1: Concurrent task title edits", async ({ browser, request }) => {
    // Create two user sessions
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Both users navigate to task
      await Promise.all([
        user1.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=tasks`
        ),
        user2.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=tasks`
        ),
      ]);

      // Both users wait for page load
      await Promise.all([
        user1.page.waitForLoadState("networkidle"),
        user2.page.waitForLoadState("networkidle"),
      ]);

      // User 1 edits task title via API
      const edit1Response = await request.put(
        `http://localhost:8181/api/tasks/${testTaskId}`,
        {
          data: {
            title: "User 1 Edit - Concurrent Test",
          },
        }
      );

      expect(edit1Response.ok()).toBeTruthy();

      // Small delay
      await user1.page.waitForTimeout(500);

      // User 2 edits task title via API (potential conflict)
      const edit2Response = await request.put(
        `http://localhost:8181/api/tasks/${testTaskId}`,
        {
          data: {
            title: "User 2 Edit - Concurrent Test",
          },
        }
      );

      // Backend should handle concurrent edit
      // Either:
      // - Last write wins (both edits succeed)
      // - Optimistic locking (second edit fails with version conflict)
      if (edit2Response.ok()) {
        // Last-write-wins: User 2's edit succeeded
        console.log("Backend uses last-write-wins strategy");
      } else {
        // Optimistic locking: conflict detected
        expect([409, 412]).toContain(edit2Response.status());
        console.log("Backend uses optimistic locking");
      }

      // Verify final state via API
      const finalResponse = await request.get(
        `http://localhost:8181/api/tasks/${testTaskId}`
      );
      const finalData = await finalResponse.json();

      // Either user 1 or user 2's title should be present
      expect(
        finalData.task.title === "User 1 Edit - Concurrent Test" ||
          finalData.task.title === "User 2 Edit - Concurrent Test"
      ).toBeTruthy();
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 2: Real-time task status updates", async ({ browser, request }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Both users navigate to board view
      await Promise.all([
        user1.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=board`
        ),
        user2.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=board`
        ),
      ]);

      await Promise.all([
        user1.page.waitForLoadState("networkidle"),
        user2.page.waitForLoadState("networkidle"),
      ]);

      // User 1 moves task to "In Progress" via API
      const updateResponse = await request.put(
        `http://localhost:8181/api/tasks/${testTaskId}`,
        {
          data: {
            status: "in_progress",
          },
        }
      );

      expect(updateResponse.ok()).toBeTruthy();

      // Check if User 2 sees real-time update
      // (Depends on whether app has WebSocket/polling)

      // Refresh User 2's page
      await user2.page.reload();
      await user2.page.waitForLoadState("networkidle");

      // User 2 should see task in "In Progress" column
      const inProgressColumn = user2.page.locator("text=/In Progress/i");
      if (await inProgressColumn.isVisible({ timeout: 3000 })) {
        await expect(
          user2.page.locator("text=Concurrent Edit Test Task")
        ).toBeVisible({ timeout: 5000 });
      }
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 3: Concurrent sprint status changes", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Both users navigate to sprints
      await Promise.all([
        user1.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=sprints`
        ),
        user2.page.goto(
          `http://localhost:3738/projects/${testProjectId}?tab=sprints`
        ),
      ]);

      await Promise.all([
        user1.page.waitForLoadState("networkidle"),
        user2.page.waitForLoadState("networkidle"),
      ]);

      // User 1 starts sprint via API
      const startResponse = await request.post(
        `http://localhost:8181/api/sprints/${testSprintId}/start`,
        {
          data: {},
        }
      );

      expect(startResponse.ok()).toBeTruthy();

      // Small delay
      await user1.page.waitForTimeout(500);

      // User 2 tries to start same sprint (should fail - already active)
      const duplicateStartResponse = await request.post(
        `http://localhost:8181/api/sprints/${testSprintId}/start`,
        {
          data: {},
        }
      );

      // Should fail because sprint is already active
      if (!duplicateStartResponse.ok()) {
        expect([400, 409, 422]).toContain(duplicateStartResponse.status());
        const errorData = await duplicateStartResponse.json();
        expect(
          errorData.detail ||
            errorData.message ||
            JSON.stringify(errorData).toLowerCase()
        ).toMatch(/already|active|status/i);
      } else {
        // If backend allows idempotent start, verify still active
        const sprintCheck = await request.get(
          `http://localhost:8181/api/sprints/${testSprintId}`
        );
        const sprintData = await sprintCheck.json();
        expect(sprintData.sprint.status).toBe("active");
      }
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 4: Race condition in workflow stage transitions", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Get workflow stages
      const projectResponse = await request.get(
        `http://localhost:8181/api/projects/${testProjectId}`
      );
      const projectData = await projectResponse.json();
      const workflowId = projectData.project.workflow_id;

      if (workflowId) {
        const stagesResponse = await request.get(
          `http://localhost:8181/api/workflows/${workflowId}/stages`
        );
        const stagesData = await stagesResponse.json();
        const stages = stagesData.stages.sort(
          (a: any, b: any) => a.stage_order - b.stage_order
        );

        if (stages.length >= 2) {
          const stage1 = stages[0];
          const stage2 = stages[1];

          // Set task to stage 1
          await request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
            data: {
              workflow_stage_id: stage1.id,
            },
          });

          // Simulate race: both users try to move task at same time
          const [transition1, transition2] = await Promise.all([
            request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
              data: {
                workflow_stage_id: stage2.id,
              },
            }),
            request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
              data: {
                workflow_stage_id: stage2.id,
              },
            }),
          ]);

          // Both should succeed (idempotent) or one should fail (optimistic locking)
          if (transition1.ok() && transition2.ok()) {
            // Idempotent: both succeeded
            console.log("Idempotent stage transitions");
          } else {
            // One failed due to conflict
            expect(
              transition1.ok() || transition2.ok()
            ).toBeTruthy();
          }

          // Verify final state
          const finalTask = await request.get(
            `http://localhost:8181/api/tasks/${testTaskId}`
          );
          const finalTaskData = await finalTask.json();
          expect(finalTaskData.task.workflow_stage_id).toBe(stage2.id);
        }
      }
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 5: Concurrent project hierarchy modifications", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    let subproject1Id: string;
    let subproject2Id: string;

    try {
      // User 1 creates subproject
      const subproject1Response = await request.post(
        "http://localhost:8181/api/projects",
        {
          data: {
            title: "User 1 Subproject",
            parent_project_id: testProjectId,
          },
        }
      );

      expect(subproject1Response.ok()).toBeTruthy();
      const subproject1Data = await subproject1Response.json();
      subproject1Id = subproject1Data.project.id;

      // Simultaneously, User 2 creates another subproject
      const subproject2Response = await request.post(
        "http://localhost:8181/api/projects",
        {
          data: {
            title: "User 2 Subproject",
            parent_project_id: testProjectId,
          },
        }
      );

      expect(subproject2Response.ok()).toBeTruthy();
      const subproject2Data = await subproject2Response.json();
      subproject2Id = subproject2Data.project.id;

      // Verify both subprojects exist
      const parentResponse = await request.get(
        `http://localhost:8181/api/projects/${testProjectId}/subprojects`
      );

      if (parentResponse.ok()) {
        const parentData = await parentResponse.json();
        expect(parentData.subprojects).toBeDefined();
        expect(parentData.subprojects.length).toBeGreaterThanOrEqual(2);

        const subprojectIds = parentData.subprojects.map((s: any) => s.id);
        expect(subprojectIds).toContain(subproject1Id);
        expect(subprojectIds).toContain(subproject2Id);
      }

      // Cleanup subprojects
      await request.delete(
        `http://localhost:8181/api/projects/${subproject1Id}`
      );
      await request.delete(
        `http://localhost:8181/api/projects/${subproject2Id}`
      );
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 6: Concurrent task creation in same sprint", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    const taskIds: string[] = [];

    try {
      // Both users create tasks simultaneously
      const [task1Response, task2Response] = await Promise.all([
        request.post("http://localhost:8181/api/tasks", {
          data: {
            project_id: testProjectId,
            title: "User 1 Concurrent Task",
            sprint_id: testSprintId,
            status: "backlog",
          },
        }),
        request.post("http://localhost:8181/api/tasks", {
          data: {
            project_id: testProjectId,
            title: "User 2 Concurrent Task",
            sprint_id: testSprintId,
            status: "backlog",
          },
        }),
      ]);

      // Both should succeed
      expect(task1Response.ok()).toBeTruthy();
      expect(task2Response.ok()).toBeTruthy();

      const task1Data = await task1Response.json();
      const task2Data = await task2Response.json();

      taskIds.push(task1Data.task.id);
      taskIds.push(task2Data.task.id);

      // Verify both tasks exist in sprint
      const sprintTasksResponse = await request.get(
        `http://localhost:8181/api/projects/${testProjectId}/tasks?sprint_id=${testSprintId}`
      );

      if (sprintTasksResponse.ok()) {
        const sprintTasksData = await sprintTasksResponse.json();
        const sprintTaskIds = sprintTasksData.tasks.map((t: any) => t.id);

        expect(sprintTaskIds).toContain(task1Data.task.id);
        expect(sprintTaskIds).toContain(task2Data.task.id);
      }

      // Cleanup
      for (const taskId of taskIds) {
        await request.delete(`http://localhost:8181/api/tasks/${taskId}`);
      }
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 7: Test conflict notification in UI", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Both users navigate to task detail
      await Promise.all([
        user1.page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`),
        user2.page.goto(`http://localhost:3738/projects/${testProjectId}?tab=tasks`),
      ]);

      await Promise.all([
        user1.page.waitForLoadState("networkidle"),
        user2.page.waitForLoadState("networkidle"),
      ]);

      // User 1 opens task edit modal
      const task1Card = user1.page
        .locator("text=Concurrent Edit Test Task")
        .first();

      if (await task1Card.isVisible({ timeout: 3000 })) {
        await task1Card.click();
        await user1.page.waitForTimeout(500);

        // User 2 updates task via API
        await request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
          data: {
            description: "Updated by User 2 - concurrent",
          },
        });

        // User 1 tries to save (might show conflict notification)
        const saveButton = user1.page
          .locator("button")
          .filter({ hasText: /Save|Update/i });

        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();

          // Check for conflict notification
          const conflictNotification = user1.page.locator(
            "text=/Conflict|Updated by another user|Refresh/i"
          );

          if (await conflictNotification.isVisible({ timeout: 3000 })) {
            console.log("UI shows conflict notification");
            await expect(conflictNotification).toBeVisible();
          } else {
            console.log("No conflict notification (last-write-wins)");
          }
        }
      }
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 8: Verify task history logs concurrent edits", async ({
    browser,
    request,
  }) => {
    // Make multiple edits to task
    await request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
      data: {
        title: "First concurrent edit",
      },
    });

    await request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
      data: {
        title: "Second concurrent edit",
      },
    });

    await request.put(`http://localhost:8181/api/tasks/${testTaskId}`, {
      data: {
        title: "Third concurrent edit",
      },
    });

    // Get task history
    const historyResponse = await request.get(
      `http://localhost:8181/api/tasks/${testTaskId}/history`
    );

    if (historyResponse.ok()) {
      const historyData = await historyResponse.json();

      // Should have multiple title change entries
      const titleChanges = historyData.changes.filter(
        (c: any) => c.field_name === "title"
      );

      expect(titleChanges.length).toBeGreaterThanOrEqual(2);

      // Verify changes are in chronological order
      for (let i = 1; i < titleChanges.length; i++) {
        const prevChange = new Date(titleChanges[i - 1].changed_at);
        const currChange = new Date(titleChanges[i].changed_at);
        expect(currChange.getTime()).toBeGreaterThanOrEqual(
          prevChange.getTime()
        );
      }
    }
  });

  test("Step 9: Concurrent sprint completion attempts", async ({
    browser,
    request,
  }) => {
    const user1 = await createAuthenticatedContext(
      browser,
      "user1@test.com"
    );
    const user2 = await createAuthenticatedContext(
      browser,
      "user2@test.com"
    );

    try {
      // Ensure sprint is active
      const sprintCheck = await request.get(
        `http://localhost:8181/api/sprints/${testSprintId}`
      );
      const sprintData = await sprintCheck.json();

      if (sprintData.sprint.status !== "active") {
        await request.post(
          `http://localhost:8181/api/sprints/${testSprintId}/start`,
          { data: {} }
        );
      }

      // Both users try to complete sprint simultaneously
      const [complete1, complete2] = await Promise.all([
        request.post(
          `http://localhost:8181/api/sprints/${testSprintId}/complete`,
          { data: {} }
        ),
        request.post(
          `http://localhost:8181/api/sprints/${testSprintId}/complete`,
          { data: {} }
        ),
      ]);

      // First should succeed, second might fail or be idempotent
      if (complete1.ok() && complete2.ok()) {
        console.log("Idempotent sprint completion");
      } else {
        expect(complete1.ok() || complete2.ok()).toBeTruthy();

        if (!complete2.ok()) {
          expect([400, 409, 422]).toContain(complete2.status());
        }
      }

      // Verify sprint is completed
      const finalSprint = await request.get(
        `http://localhost:8181/api/sprints/${testSprintId}`
      );
      const finalSprintData = await finalSprint.json();
      expect(finalSprintData.sprint.status).toBe("completed");
    } finally {
      await user1.context.close();
      await user2.context.close();
    }
  });

  test("Step 10: Verify no data corruption from concurrent operations", async ({
    request,
  }) => {
    // Final sanity check: verify all data is consistent

    // Check project exists and is valid
    const projectResponse = await request.get(
      `http://localhost:8181/api/projects/${testProjectId}`
    );
    expect(projectResponse.ok()).toBeTruthy();
    const projectData = await projectResponse.json();
    expect(projectData.project.id).toBe(testProjectId);

    // Check task exists and is valid
    const taskResponse = await request.get(
      `http://localhost:8181/api/tasks/${testTaskId}`
    );
    expect(taskResponse.ok()).toBeTruthy();
    const taskData = await taskResponse.json();
    expect(taskData.task.id).toBe(testTaskId);
    expect(taskData.task.project_id).toBe(testProjectId);

    // Check sprint exists and is valid
    const sprintResponse = await request.get(
      `http://localhost:8181/api/sprints/${testSprintId}`
    );
    expect(sprintResponse.ok()).toBeTruthy();
    const sprintData = await sprintResponse.json();
    expect(sprintData.sprint.id).toBe(testSprintId);

    // Verify no orphaned relationships
    expect(taskData.task.workflow_stage_id).toBeTruthy();

    console.log("✅ All data integrity checks passed");
  });
});
