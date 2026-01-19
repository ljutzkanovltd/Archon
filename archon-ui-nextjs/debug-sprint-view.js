const { chromium } = require('playwright');

async function debugSprintView() {
  console.log('🚀 Starting debug session...');

  const browser = await chromium.launch({
    headless: false, // Show browser so we can see what's happening
    slowMo: 500, // Slow down for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: './debug-videos/',
      size: { width: 1920, height: 1080 }
    }
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      console.log(`[Browser ${type}]:`, msg.text());
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.error('[Page Error]:', error.message);
  });

  try {
    console.log('📍 Navigating to project page...');
    await page.goto('http://localhost:3738/projects/91239a27-174a-42f8-b8b0-bbe4624887f0', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log('📸 Taking screenshot: 01-project-loaded.png');
    await page.screenshot({ path: './debug-screenshots/01-project-loaded.png', fullPage: true });

    console.log('🔄 Waiting for page to stabilize...');
    await page.waitForTimeout(2000);

    // Try to find and click Timeline view button
    console.log('🔍 Looking for Timeline view button...');
    const timelineButton = await page.locator('button:has-text("Timeline"), [aria-label*="Timeline"]').first();

    if (await timelineButton.count() > 0) {
      console.log('✅ Found Timeline button, clicking...');
      await timelineButton.click();
      await page.waitForTimeout(2000);

      console.log('📸 Taking screenshot: 02-timeline-view-clicked.png');
      await page.screenshot({ path: './debug-screenshots/02-timeline-view-clicked.png', fullPage: true });
    } else {
      console.log('⚠️ Timeline button not found');
    }

    // Check for error boundary
    const errorBoundary = await page.locator('text=/ErrorBoundary|Something went wrong/i').first();
    if (await errorBoundary.count() > 0) {
      console.log('❌ Error boundary detected!');
      await page.screenshot({ path: './debug-screenshots/03-error-boundary.png', fullPage: true });
    }

    // Try to capture any visible errors
    const errorMessages = await page.locator('[class*="error"], [role="alert"]').all();
    if (errorMessages.length > 0) {
      console.log(`⚠️ Found ${errorMessages.length} error message(s)`);
      await page.screenshot({ path: './debug-screenshots/04-error-messages.png', fullPage: true });
    }

    console.log('📸 Taking final screenshot...');
    await page.screenshot({ path: './debug-screenshots/05-final-state.png', fullPage: true });

    console.log('\n✅ Debug session complete!');
    console.log('📁 Screenshots saved to: ./debug-screenshots/');
    console.log('🎥 Video saved to: ./debug-videos/');

    // Keep browser open for 5 seconds so you can inspect
    console.log('\n⏳ Browser will stay open for 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('❌ Error during debug session:', error);
    await page.screenshot({ path: './debug-screenshots/error-state.png', fullPage: true });
  } finally {
    await context.close();
    await browser.close();
  }
}

// Create directories if they don't exist
const fs = require('fs');
if (!fs.existsSync('./debug-screenshots')) {
  fs.mkdirSync('./debug-screenshots', { recursive: true });
}
if (!fs.existsSync('./debug-videos')) {
  fs.mkdirSync('./debug-videos', { recursive: true });
}

debugSprintView().catch(console.error);
