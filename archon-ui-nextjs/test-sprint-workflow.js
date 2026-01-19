const { chromium } = require('playwright');
const fs = require('fs');

/**
 * Comprehensive Sprint Workflow Test
 *
 * Tests:
 * 1. Login flow with token persistence
 * 2. Navigate to project
 * 3. Create new sprint
 * 4. Assign tasks to sprint
 * 5. Verify sprint appears in views
 */

async function testSprintWorkflow() {
  console.log('🚀 Starting Sprint Workflow Test...\n');

  const browser = await chromium.launch({
    headless: false, // Show browser for visual verification
    slowMo: 1000, // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: './test-videos/',
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Enable detailed console logging
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.log(`❌ [Browser Error]:`, text);
    } else if (type === 'warning') {
      console.log(`⚠️  [Browser Warning]:`, text);
    } else if (text.includes('[')) {
      console.log(`📝 [Browser]:`, text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error('💥 [Page Error]:', error.message);
  });

  // Track network requests
  const networkLog = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) {
      networkLog.push({
        method: request.method(),
        url: request.url(),
        time: new Date().toISOString()
      });
    }
  });

  page.on('response', response => {
    if (response.url().includes('/api/')) {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        console.log(`❌ API Error: ${status} ${url}`);
      }
    }
  });

  try {
    // ================== STEP 1: LOGIN ==================
    console.log('\n📍 Step 1: Navigate to login page...');
    await page.goto('http://localhost:3738/login', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.screenshot({ path: './test-screenshots/01-login-page.png', fullPage: true });
    console.log('✅ Login page loaded');

    // Check if already logged in (token in localStorage)
    const existingToken = await page.evaluate(() => localStorage.getItem('archon_token'));

    if (existingToken) {
      console.log('✅ Existing token found, checking validity...');

      // Try to access protected page to verify token
      await page.goto('http://localhost:3738/projects', {
        waitUntil: 'networkidle',
        timeout: 10000
      });

      // If we're still on login page, token is invalid
      const currentUrl = page.url();
      if (currentUrl.includes('/login')) {
        console.log('⚠️  Token expired, need to login again');
      } else {
        console.log('✅ Token valid, skipping login');
        await page.screenshot({ path: './test-screenshots/01b-already-logged-in.png', fullPage: true });
        goto_project = true; // Skip to step 2
      }
    }

    if (!existingToken || page.url().includes('/login')) {
      console.log('🔐 Performing login...');

      // Use environment variables or defaults
      const email = process.env.TEST_EMAIL || 'admin@archon.dev';
      const password = process.env.TEST_PASSWORD || 'admin123#';

      console.log(`   Using credentials: ${email}`);

      // Fill login form
      await page.fill('input[name="email"], input[type="email"]', email);
      await page.fill('input[name="password"], input[type="password"]', password);

      await page.screenshot({ path: './test-screenshots/02-login-form-filled.png', fullPage: true });

      // Submit login
      await page.click('button[type="submit"]');
      console.log('⏳ Waiting for login response...');

      // Wait for redirect or error
      await page.waitForTimeout(3000);

      const loginUrl = page.url();
      if (loginUrl.includes('/login')) {
        console.log('❌ Login failed - still on login page');
        await page.screenshot({ path: './test-screenshots/03-login-failed.png', fullPage: true });

        // Check for error messages
        const errorMsg = await page.locator('[role="alert"], .error, [class*="error"]').first().textContent().catch(() => null);
        if (errorMsg) {
          console.log(`❌ Error message: ${errorMsg}`);
        }
        throw new Error('Login failed');
      }

      console.log('✅ Login successful, redirected to:', loginUrl);
      await page.screenshot({ path: './test-screenshots/03-after-login.png', fullPage: true });

      // Verify token stored
      const token = await page.evaluate(() => localStorage.getItem('archon_token'));
      if (token) {
        console.log('✅ Auth token stored in localStorage');
        console.log(`   Token preview: ${token.substring(0, 50)}...`);
      } else {
        console.log('⚠️  No token found in localStorage');
      }
    }

    // ================== STEP 2: NAVIGATE TO PROJECT ==================
    console.log('\n📍 Step 2: Navigate to project...');
    const projectId = '91239a27-174a-42f8-b8b0-bbe4624887f0';
    await page.goto(`http://localhost:3738/projects/${projectId}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    await page.screenshot({ path: './test-screenshots/04-project-page.png', fullPage: true });
    console.log('✅ Project page loaded');

    // Wait for project data to load
    await page.waitForTimeout(2000);

    // ================== STEP 3: CREATE SPRINT ==================
    console.log('\n📍 Step 3: Create new sprint...');

    // Look for "New Sprint" button or similar
    const newSprintButton = page.locator('button:has-text("New Sprint"), button:has-text("Create Sprint"), [aria-label*="Sprint"]').first();

    if (await newSprintButton.count() === 0) {
      console.log('⚠️  New Sprint button not found, looking for alternative...');
      await page.screenshot({ path: './test-screenshots/05-no-sprint-button.png', fullPage: true });
    } else {
      console.log('✅ Found sprint creation button');

      // Click to open modal
      await newSprintButton.click();
      console.log('✅ Clicked New Sprint button');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: './test-screenshots/06-sprint-modal-open.png', fullPage: true });

      // Fill sprint form
      const sprintName = `Test Sprint ${Date.now()}`;
      console.log(`📝 Creating sprint: ${sprintName}`);

      await page.fill('input[name="name"], input[id*="sprint-name"]', sprintName);

      // Fill sprint goal (optional)
      const goalInput = page.locator('textarea[name="goal"], textarea[id*="sprint-goal"]').first();
      if (await goalInput.count() > 0) {
        await goalInput.fill('Test sprint created via Playwright automation');
      }

      // Dates might be pre-filled, check if they need updating
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 14);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      await page.fill('input[type="date"][name="start_date"], input[type="date"][id*="start-date"]', startDateStr);
      await page.fill('input[type="date"][name="end_date"], input[type="date"][id*="end-date"]', endDateStr);

      console.log(`   Start: ${startDateStr}`);
      console.log(`   End: ${endDateStr}`);

      await page.screenshot({ path: './test-screenshots/07-sprint-form-filled.png', fullPage: true });

      // Scroll modal content to bottom to make submit button visible
      await page.evaluate(() => {
        // Find the modal body container
        const modalBody = document.querySelector('.max-h-\\[80vh\\].overflow-auto');
        if (modalBody) {
          modalBody.scrollTo(0, modalBody.scrollHeight);
        }
      });
      await page.waitForTimeout(1000);

      // Take screenshot after scroll to verify button is visible
      await page.screenshot({ path: './test-screenshots/07b-sprint-form-scrolled.png', fullPage: true });

      // Submit form - find the visible submit button in the modal
      console.log('⏳ Submitting sprint creation...');

      // Check current token before submission
      const tokenBefore = await page.evaluate(() => localStorage.getItem('archon_token'));
      console.log(`   Token exists before submit: ${!!tokenBefore}`);

      // Click the submit button - look for type=submit with exact text "Create Sprint"
      const submitButton = page.locator('button[type="submit"]').filter({ hasText: 'Create Sprint' });
      await submitButton.click();

      // Wait for response
      await page.waitForTimeout(3000);

      // Check if modal closed (success) or still open (error)
      const modalStillOpen = await page.locator('[role="dialog"], .modal').count();

      if (modalStillOpen > 0) {
        console.log('⚠️  Modal still open, checking for errors...');
        await page.screenshot({ path: './test-screenshots/08-sprint-creation-error.png', fullPage: true });

        // Check for error toast
        const errorToast = await page.locator('[role="alert"], .error, [class*="error"]').first().textContent().catch(() => null);
        if (errorToast) {
          console.log(`❌ Error: ${errorToast}`);
        }

        // Check if we were redirected to login
        const currentUrl = page.url();
        if (currentUrl.includes('/login')) {
          console.log('❌ CRITICAL: Redirected to login after sprint creation attempt');
          console.log('   This indicates token expired or permission denied');
          await page.screenshot({ path: './test-screenshots/09-redirected-to-login.png', fullPage: true });
          throw new Error('Authentication issue during sprint creation');
        }
      } else {
        console.log('✅ Sprint creation successful! Modal closed.');
        await page.screenshot({ path: './test-screenshots/08-sprint-created-success.png', fullPage: true });

        // Wait for data to refresh
        await page.waitForTimeout(2000);
        await page.screenshot({ path: './test-screenshots/09-after-sprint-creation.png', fullPage: true });
      }
    }

    // ================== STEP 4: VERIFY SPRINT APPEARS ==================
    console.log('\n📍 Step 4: Verify sprint appears in views...');

    // Look for sprint in the page
    const sprintElements = await page.locator('[class*="sprint"], [data-sprint-id]').count();
    console.log(`   Found ${sprintElements} sprint element(s)`);

    // Try Timeline view
    const timelineButton = page.locator('button:has-text("Timeline"), [aria-label*="Timeline"]').first();
    if (await timelineButton.count() > 0) {
      console.log('🔄 Switching to Timeline view...');
      await timelineButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: './test-screenshots/10-timeline-view.png', fullPage: true });
    }

    // ================== STEP 5: ASSIGN TASKS TO SPRINT ==================
    console.log('\n📍 Step 5: Testing task assignment to sprint...');

    // Navigate back to main project view
    await page.goto(`http://localhost:3738/projects/${projectId}`, {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    // Look for tasks
    const taskCards = await page.locator('[class*="TaskCard"], [data-task-id]').count();
    console.log(`   Found ${taskCards} task(s)`);

    if (taskCards > 0) {
      // Try to edit first task and assign to sprint
      const firstTask = page.locator('[class*="TaskCard"], [data-task-id]').first();
      const editButton = firstTask.locator('button:has-text("Edit"), [aria-label*="Edit"]').first();

      if (await editButton.count() > 0) {
        await editButton.click();
        console.log('✅ Opened task edit modal');
        await page.waitForTimeout(1000);
        await page.screenshot({ path: './test-screenshots/11-task-edit-modal.png', fullPage: true });

        // Look for sprint dropdown
        const sprintSelect = page.locator('select[name="sprint_id"], [id*="sprint"]').first();
        if (await sprintSelect.count() > 0) {
          await sprintSelect.selectOption({ index: 1 }); // Select first sprint
          console.log('✅ Assigned task to sprint');

          // Save
          await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: './test-screenshots/12-task-assigned.png', fullPage: true });
        }
      }
    }

    // ================== FINAL SCREENSHOTS ==================
    console.log('\n📸 Taking final verification screenshots...');
    await page.screenshot({ path: './test-screenshots/13-final-state.png', fullPage: true });

    // Save network log
    fs.writeFileSync('./test-screenshots/network-log.json', JSON.stringify(networkLog, null, 2));
    console.log('💾 Network log saved');

    console.log('\n✅ Sprint Workflow Test Complete!');
    console.log('📁 Screenshots saved to: ./test-screenshots/');
    console.log('🎥 Video saved to: ./test-videos/');

    // Keep browser open for inspection
    console.log('\n⏳ Browser will stay open for 10 seconds for inspection...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n💥 Test Failed:', error.message);
    await page.screenshot({ path: './test-screenshots/error-final-state.png', fullPage: true });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Create directories
if (!fs.existsSync('./test-screenshots')) {
  fs.mkdirSync('./test-screenshots', { recursive: true });
}
if (!fs.existsSync('./test-videos')) {
  fs.mkdirSync('./test-videos', { recursive: true });
}

// Run test
testSprintWorkflow().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
