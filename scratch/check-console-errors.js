const { chromium } = require('@playwright/test');

async function run() {
  console.log('Connecting to http://localhost:3000...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    } else {
      console.log(`[CONSOLE LOG] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`[PAGE UNCAUGHT ERROR] ${err.toString()}`);
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 10000 });
    console.log('Page loaded successfully');
    
    // Wait extra seconds to see if async errors pop up
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (e) {
    console.error('Error navigating:', e.message);
  } finally {
    await browser.close();
  }
}

run();
