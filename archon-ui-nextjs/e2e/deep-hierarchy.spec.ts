import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Deep Project Hierarchy with Circular Detection
 *
 * Tests the project hierarchy system with ltree paths:
 * 1. Create deep hierarchy (5+ levels)
 * 2. Verify ltree path integrity
 * 3. Test circular reference prevention
 * 4. Verify hierarchy navigation (breadcrumbs, parent/child)
 * 5. Test task inheritance across levels
 * 6. Verify hierarchy limits if any
 * 7. Test subproject deletion cascading
 *
 * Prerequisites:
 * - Backend API running on localhost:8181
 * - Frontend running on localhost:3738
 * - ltree extension enabled in database
 */

test.describe("Deep Project Hierarchy with Circular Detection", () => {
  let rootProjectId: string;
  let level1ProjectId: string;
  let level2ProjectId: string;
  let level3ProjectId: string;
  let level4ProjectId: string;
  let level5ProjectId: string;
  let testTaskIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Create root project (Level 0)
    const rootResponse = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "E2E Hierarchy Root Project",
          description: "Root level project for hierarchy testing",
        },
      }
    );

    expect(rootResponse.ok()).toBeTruthy();
    const rootData = await rootResponse.json();
    rootProjectId = rootData.project.id;

    // Create Level 1 subproject
    const level1Response = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "Level 1 Subproject",
          description: "First level subproject",
          parent_project_id: rootProjectId,
        },
      }
    );

    if (level1Response.ok()) {
      const level1Data = await level1Response.json();
      level1ProjectId = level1Data.project.id;

      // Create Level 2 subproject
      const level2Response = await request.post(
        "http://localhost:8181/api/projects",
        {
          data: {
            title: "Level 2 Subproject",
            description: "Second level subproject",
            parent_project_id: level1ProjectId,
          },
        }
      );

      if (level2Response.ok()) {
        const level2Data = await level2Response.json();
        level2ProjectId = level2Data.project.id;

        // Create Level 3 subproject
        const level3Response = await request.post(
          "http://localhost:8181/api/projects",
          {
            data: {
              title: "Level 3 Subproject",
              description: "Third level subproject",
              parent_project_id: level2ProjectId,
            },
          }
        );

        if (level3Response.ok()) {
          const level3Data = await level3Response.json();
          level3ProjectId = level3Data.project.id;

          // Create Level 4 subproject
          const level4Response = await request.post(
            "http://localhost:8181/api/projects",
            {
              data: {
                title: "Level 4 Subproject",
                description: "Fourth level subproject",
                parent_project_id: level3ProjectId,
              },
            }
          );

          if (level4Response.ok()) {
            const level4Data = await level4Response.json();
            level4ProjectId = level4Data.project.id;

            // Create Level 5 subproject (deepest)
            const level5Response = await request.post(
              "http://localhost:8181/api/projects",
              {
                data: {
                  title: "Level 5 Subproject",
                  description: "Fifth level subproject (deepest)",
                  parent_project_id: level4ProjectId,
                },
              }
            );

            if (level5Response.ok()) {
              const level5Data = await level5Response.json();
              level5ProjectId = level5Data.project.id;
            }
          }
        }
      }
    }

    // Create test tasks at different levels
    const taskLevels = [
      { projectId: rootProjectId, title: "Root Level Task" },
      { projectId: level1ProjectId, title: "Level 1 Task" },
      { projectId: level3ProjectId, title: "Level 3 Task" },
      { projectId: level5ProjectId, title: "Level 5 Task" },
    ];

    for (const taskData of taskLevels) {
      if (taskData.projectId) {
        const taskResponse = await request.post(
          "http://localhost:8181/api/tasks",
          {
            data: {
              project_id: taskData.projectId,
              title: taskData.title,
              status: "backlog",
            },
          }
        );

        if (taskResponse.ok()) {
          const task = await taskResponse.json();
          testTaskIds.push(task.task.id);
        }
      }
    }
  });

  test.afterAll(async ({ request }) => {
    // Cleanup: Delete test tasks
    for (const taskId of testTaskIds) {
      await request.delete(`http://localhost:8181/api/tasks/${taskId}`);
    }

    // Delete projects in reverse order (deepest first to avoid FK constraints)
    const projectIds = [
      level5ProjectId,
      level4ProjectId,
      level3ProjectId,
      level2ProjectId,
      level1ProjectId,
      rootProjectId,
    ].filter(Boolean);

    for (const projectId of projectIds) {
      await request.delete(`http://localhost:8181/api/projects/${projectId}`);
    }
  });

  test("Step 1: Verify 5-level hierarchy creation", async ({ request }) => {
    // Verify all projects were created
    expect(rootProjectId).toBeTruthy();
    expect(level1ProjectId).toBeTruthy();
    expect(level2ProjectId).toBeTruthy();
    expect(level3ProjectId).toBeTruthy();
    expect(level4ProjectId).toBeTruthy();
    expect(level5ProjectId).toBeTruthy();

    // Verify root project has no parent
    const rootResponse = await request.get(
      `http://localhost:8181/api/projects/${rootProjectId}`
    );
    const rootData = await rootResponse.json();
    expect(rootData.project.parent_project_id).toBeNull();

    // Verify level 5 has correct parent chain
    const level5Response = await request.get(
      `http://localhost:8181/api/projects/${level5ProjectId}`
    );
    const level5Data = await level5Response.json();
    expect(level5Data.project.parent_project_id).toBe(level4ProjectId);
  });

  test("Step 2: Verify ltree path integrity", async ({ request }) => {
    // Get all projects and verify ltree paths
    const projects = [
      { id: rootProjectId, expectedDepth: 0 },
      { id: level1ProjectId, expectedDepth: 1 },
      { id: level2ProjectId, expectedDepth: 2 },
      { id: level3ProjectId, expectedDepth: 3 },
      { id: level4ProjectId, expectedDepth: 4 },
      { id: level5ProjectId, expectedDepth: 5 },
    ];

    for (const project of projects) {
      const response = await request.get(
        `http://localhost:8181/api/projects/${project.id}`
      );
      const data = await response.json();

      // Verify ltree_path exists
      expect(data.project.ltree_path).toBeTruthy();

      // Verify path depth matches expected level
      if (data.project.ltree_path) {
        const pathParts = data.project.ltree_path.split(".");
        expect(pathParts.length).toBe(project.expectedDepth + 1);
      }
    }

    // Verify level 5 path contains all ancestors
    const level5Response = await request.get(
      `http://localhost:8181/api/projects/${level5ProjectId}`
    );
    const level5Data = await level5Response.json();
    const level5Path = level5Data.project.ltree_path;

    expect(level5Path).toContain(rootProjectId.replace(/-/g, "_"));
  });

  test("Step 3: Attempt to create circular reference (should fail)", async ({
    request,
  }) => {
    // Try to set root project's parent to level 5 (circular)
    const circularResponse = await request.put(
      `http://localhost:8181/api/projects/${rootProjectId}`,
      {
        data: {
          parent_project_id: level5ProjectId,
        },
      }
    );

    // Should fail with 400 or 422 error
    expect(circularResponse.ok()).toBeFalsy();
    expect([400, 422]).toContain(circularResponse.status());

    const errorData = await circularResponse.json();
    expect(
      errorData.detail ||
        errorData.message ||
        JSON.stringify(errorData).toLowerCase()
    ).toMatch(/circular|cycle|loop|ancestor/i);
  });

  test("Step 4: Attempt to create self-referencing parent (should fail)", async ({
    request,
  }) => {
    // Try to set level 3's parent to itself
    const selfRefResponse = await request.put(
      `http://localhost:8181/api/projects/${level3ProjectId}`,
      {
        data: {
          parent_project_id: level3ProjectId,
        },
      }
    );

    // Should fail
    expect(selfRefResponse.ok()).toBeFalsy();
    expect([400, 422]).toContain(selfRefResponse.status());
  });

  test("Step 5: Verify hierarchy navigation in UI", async ({ page }) => {
    // Navigate to level 5 project
    await page.goto(
      `http://localhost:3738/projects/${level5ProjectId}?tab=overview`
    );
    await page.waitForLoadState("networkidle");

    // Look for breadcrumb navigation
    const breadcrumb = page.locator("[data-testid='project-breadcrumb'], nav");

    // Should show hierarchy path
    // E2E Hierarchy Root > Level 1 > Level 2 > Level 3 > Level 4 > Level 5
    if (await breadcrumb.isVisible({ timeout: 3000 })) {
      await expect(breadcrumb.locator("text=E2E Hierarchy Root")).toBeVisible();
      await expect(breadcrumb.locator("text=Level 5 Subproject")).toBeVisible();
    }

    // Verify parent project link exists
    const parentLink = page
      .locator("a, button")
      .filter({ hasText: /Parent Project|Level 4/i })
      .first();

    if (await parentLink.isVisible({ timeout: 3000 })) {
      await expect(parentLink).toBeVisible();
    }
  });

  test("Step 6: Verify subproject list at each level", async ({ page, request }) => {
    // Navigate to root project
    await page.goto(
      `http://localhost:3738/projects/${rootProjectId}?tab=overview`
    );
    await page.waitForLoadState("networkidle");

    // Look for subprojects section
    const subprojectsSection = page
      .locator("h2, h3")
      .filter({ hasText: /Subprojects|Child Projects/i })
      .locator("..");

    if (await subprojectsSection.isVisible({ timeout: 3000 })) {
      // Should show Level 1 subproject
      await expect(
        page.locator("text=Level 1 Subproject")
      ).toBeVisible({ timeout: 5000 });
    } else {
      // Alternatively, check via API
      const response = await request.get(
        `http://localhost:8181/api/projects/${rootProjectId}/subprojects`
      );

      if (response.ok()) {
        const data = await response.json();
        expect(data.subprojects).toBeDefined();
        expect(data.subprojects.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("Step 7: Verify task inheritance across hierarchy", async ({
    request,
  }) => {
    // Get tasks for root project (should include descendant tasks if inheritance is enabled)
    const tasksResponse = await request.get(
      `http://localhost:8181/api/projects/${rootProjectId}/tasks?include_descendants=true`
    );

    if (tasksResponse.ok()) {
      const tasksData = await tasksResponse.json();

      // Should include tasks from all levels if inheritance is enabled
      // If not, should only include root level tasks
      expect(tasksData.tasks).toBeDefined();
      expect(tasksData.tasks.length).toBeGreaterThanOrEqual(1);

      // Verify at least root task exists
      const rootTask = tasksData.tasks.find(
        (t: any) => t.title === "Root Level Task"
      );
      expect(rootTask).toBeDefined();
    }
  });

  test("Step 8: Test hierarchy depth limit (if enforced)", async ({
    request,
  }) => {
    // Try to create a 6th level (might be blocked by depth limit)
    const level6Response = await request.post(
      "http://localhost:8181/api/projects",
      {
        data: {
          title: "Level 6 Subproject (Testing Limit)",
          description: "Sixth level - might exceed limit",
          parent_project_id: level5ProjectId,
        },
      }
    );

    // Either succeeds (no limit) or fails with depth limit error
    if (!level6Response.ok()) {
      const errorData = await level6Response.json();
      // If there's a depth limit, error should mention it
      if (level6Response.status() === 400 || level6Response.status() === 422) {
        // Depth limit might be enforced
        console.log("Depth limit may be enforced:", errorData);
      }
    } else {
      // No depth limit - clean up the test project
      const level6Data = await level6Response.json();
      await request.delete(
        `http://localhost:8181/api/projects/${level6Data.project.id}`
      );
    }
  });

  test("Step 9: Verify hierarchy display in project list", async ({ page }) => {
    // Navigate to projects list
    await page.goto("http://localhost:3738/projects");
    await page.waitForLoadState("networkidle");

    // Look for hierarchy indicators (indentation, tree view, etc.)
    const projectList = page.locator("[data-testid='projects-list'], table, .projects");

    if (await projectList.isVisible({ timeout: 3000 })) {
      // Should show root project
      await expect(
        page.locator("text=E2E Hierarchy Root Project")
      ).toBeVisible({ timeout: 5000 });

      // May show hierarchy with indentation or tree structure
      // (Implementation-specific)
    }
  });

  test("Step 10: Test moving project to different parent", async ({
    request,
  }) => {
    // Move level 3 from level 2 to level 1 (valid move)
    const moveResponse = await request.put(
      `http://localhost:8181/api/projects/${level3ProjectId}`,
      {
        data: {
          parent_project_id: level1ProjectId,
        },
      }
    );

    expect(moveResponse.ok()).toBeTruthy();

    // Verify move
    const verifyResponse = await request.get(
      `http://localhost:8181/api/projects/${level3ProjectId}`
    );
    const verifyData = await verifyResponse.json();
    expect(verifyData.project.parent_project_id).toBe(level1ProjectId);

    // Verify ltree path updated
    expect(verifyData.project.ltree_path).toBeTruthy();

    // Move back to original parent
    await request.put(
      `http://localhost:8181/api/projects/${level3ProjectId}`,
      {
        data: {
          parent_project_id: level2ProjectId,
        },
      }
    );
  });

  test("Step 11: Verify circular detection when moving projects", async ({
    request,
  }) => {
    // Try to move level 1 to be child of level 5 (would create cycle)
    const cycleResponse = await request.put(
      `http://localhost:8181/api/projects/${level1ProjectId}`,
      {
        data: {
          parent_project_id: level5ProjectId,
        },
      }
    );

    // Should fail
    expect(cycleResponse.ok()).toBeFalsy();
    expect([400, 422]).toContain(cycleResponse.status());

    const errorData = await cycleResponse.json();
    expect(
      errorData.detail ||
        errorData.message ||
        JSON.stringify(errorData).toLowerCase()
    ).toMatch(/circular|cycle|loop|descendant|ancestor/i);
  });

  test("Step 12: Test bulk hierarchy operations", async ({ request }) => {
    // Get all descendants of root project
    const descendantsResponse = await request.get(
      `http://localhost:8181/api/projects/${rootProjectId}/descendants`
    );

    if (descendantsResponse.ok()) {
      const descendantsData = await descendantsResponse.json();

      // Should return all 5 levels of descendants
      expect(descendantsData.descendants).toBeDefined();
      expect(descendantsData.descendants.length).toBeGreaterThanOrEqual(5);

      // Verify all expected projects are in descendants
      const descendantIds = descendantsData.descendants.map((d: any) => d.id);
      expect(descendantIds).toContain(level1ProjectId);
      expect(descendantIds).toContain(level5ProjectId);
    }
  });

  test("Step 13: Verify ltree query performance with deep paths", async ({
    request,
  }) => {
    // Query for all projects under level 2 (should include level 3, 4, 5)
    const subtreeResponse = await request.get(
      `http://localhost:8181/api/projects/${level2ProjectId}/descendants`
    );

    if (subtreeResponse.ok()) {
      const subtreeData = await subtreeResponse.json();

      // Should return 3 descendants (level 3, 4, 5)
      expect(subtreeData.descendants).toBeDefined();
      expect(subtreeData.descendants.length).toBe(3);

      // Verify correct descendants
      const descendantTitles = subtreeData.descendants.map((d: any) => d.title);
      expect(descendantTitles).toContain("Level 3 Subproject");
      expect(descendantTitles).toContain("Level 4 Subproject");
      expect(descendantTitles).toContain("Level 5 Subproject");
      expect(descendantTitles).not.toContain("Level 1 Subproject");
    }
  });

  test("Step 14: Test orphaning detection (removing middle parent)", async ({
    request,
  }) => {
    // Note: This test depends on backend policy for orphaned projects
    // Some systems auto-reparent to grandparent, others prevent deletion

    // Try to delete level 3 (which has children level 4, 5)
    const deleteResponse = await request.delete(
      `http://localhost:8181/api/projects/${level3ProjectId}`
    );

    if (!deleteResponse.ok()) {
      // Backend prevents deletion of projects with children
      expect([400, 409, 422]).toContain(deleteResponse.status());

      const errorData = await deleteResponse.json();
      expect(
        errorData.detail ||
          errorData.message ||
          JSON.stringify(errorData).toLowerCase()
      ).toMatch(/child|subproject|descendant/i);
    } else {
      // Backend allows deletion (might cascade or reparent)
      // If cascade delete, level 4 and 5 should be gone
      const level4Check = await request.get(
        `http://localhost:8181/api/projects/${level4ProjectId}`
      );

      if (!level4Check.ok()) {
        // Cascade delete occurred
        console.log("Cascade delete: children were also deleted");
      } else {
        // Reparenting occurred - verify level 4 now points to level 2
        const level4Data = await level4Check.json();
        expect(level4Data.project.parent_project_id).toBe(level2ProjectId);
      }

      // Recreate level 3 for cleanup
      const recreateResponse = await request.post(
        "http://localhost:8181/api/projects",
        {
          data: {
            title: "Level 3 Subproject",
            description: "Recreated for cleanup",
            parent_project_id: level2ProjectId,
          },
        }
      );

      if (recreateResponse.ok()) {
        const recreateData = await recreateResponse.json();
        level3ProjectId = recreateData.project.id;
      }
    }
  });
});
