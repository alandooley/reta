const { test, expect } = require('@playwright/test');

test('Results page redesign verification', async ({ page }) => {
  const consoleMessages = [];
  const errors = [];

  // Capture console messages and errors
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(text);
    if (text.includes('error') || text.includes('Error')) {
      console.log(`[CONSOLE ERROR] ${text}`);
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  console.log('\n=== Step 1: Navigate to local app ===');
  await page.goto('http://localhost:3000/');
  await page.waitForTimeout(2000);

  // Check if auth gate is visible
  const authGateVisible = await page.locator('#auth-gate').isVisible().catch(() => false);
  console.log('Auth gate visible:', authGateVisible);

  if (authGateVisible) {
    console.log('⚠️ Auth gate is blocking access, bypassing for testing...');
    // Hide auth gate and show main app for testing
    await page.evaluate(() => {
      const authGate = document.getElementById('auth-gate');
      const app = document.getElementById('app');
      const bottomNav = document.getElementById('bottom-nav');

      if (authGate) authGate.style.display = 'none';
      if (app) app.style.display = 'block';
      if (bottomNav) bottomNav.style.display = 'flex';
    });
    await page.waitForTimeout(500);
  }

  console.log('\n=== Step 2: Click on Results tab ===');
  const resultsTab = page.locator('button:has-text("Results")');
  await resultsTab.click();
  await page.waitForTimeout(1000);

  console.log('\n=== Step 3: Check for new Results header ===');
  const resultsHeader = await page.locator('.results-header h2').textContent();
  console.log('Results header text:', resultsHeader);
  expect(resultsHeader).toBe('Results');

  const addShotBtn = await page.locator('.add-shot-btn-results').count();
  console.log('Add shot button found:', addShotBtn > 0);
  expect(addShotBtn).toBeGreaterThan(0);

  console.log('\n=== Step 4: Check for time period segmented control ===');
  const periodButtons = await page.locator('.period-btn').count();
  console.log('Number of period buttons:', periodButtons);
  expect(periodButtons).toBe(4);

  // Check button labels
  const button1Text = await page.locator('.period-btn').nth(0).textContent();
  const button2Text = await page.locator('.period-btn').nth(1).textContent();
  const button3Text = await page.locator('.period-btn').nth(2).textContent();
  const button4Text = await page.locator('.period-btn').nth(3).textContent();
  console.log('Period buttons:', [button1Text, button2Text, button3Text, button4Text]);
  expect(button1Text).toBe('1 month');
  expect(button2Text).toBe('3 months');
  expect(button3Text).toBe('6 months');
  expect(button4Text).toBe('All time');

  // Check first button has active class
  const firstBtnActive = await page.locator('.period-btn').nth(0).evaluate(el => el.classList.contains('active'));
  console.log('First button is active:', firstBtnActive);
  expect(firstBtnActive).toBe(true);

  console.log('\n=== Step 5: Check for Weight Change section ===');
  const sectionTitle = await page.locator('.section-title h3').textContent();
  console.log('Section title:', sectionTitle);
  expect(sectionTitle).toBe('Weight Change');

  const dateRange = await page.locator('.date-range').textContent();
  console.log('Date range:', dateRange);

  console.log('\n=== Step 6: Check for 6 metric cards ===');
  const metricCards = await page.locator('.result-card').count();
  console.log('Number of metric cards:', metricCards);
  expect(metricCards).toBe(6);

  // Check each metric label
  const labels = [];
  for (let i = 0; i < metricCards; i++) {
    const label = await page.locator('.result-card').nth(i).locator('.result-label').textContent();
    labels.push(label.trim());
  }
  console.log('Metric labels:', labels);

  console.log('\n=== Step 7: Test time period button switching ===');
  console.log('Clicking "3 months" button...');
  await page.locator('.period-btn[data-months="3"]').click();
  await page.waitForTimeout(500);

  const secondBtnActive = await page.locator('.period-btn[data-months="3"]').evaluate(el => el.classList.contains('active'));
  console.log('Second button is now active:', secondBtnActive);
  expect(secondBtnActive).toBe(true);

  const firstBtnNotActive = await page.locator('.period-btn').nth(0).evaluate(el => el.classList.contains('active'));
  console.log('First button is no longer active:', !firstBtnNotActive);
  expect(firstBtnNotActive).toBe(false);

  console.log('\n=== Step 8: Check for chart ===');
  const chartCanvas = await page.locator('#weight-chart').count();
  console.log('Chart canvas found:', chartCanvas > 0);

  // Take screenshot
  await page.screenshot({ path: 'tests/screenshots/results-redesign.png', fullPage: true });
  console.log('\n✅ Screenshot saved to tests/screenshots/results-redesign.png');

  console.log('\n=== Errors Summary ===');
  if (errors.length === 0) {
    console.log('✅ No page errors detected');
  } else {
    console.log('❌ Page errors found:');
    errors.forEach(err => console.log(`  - ${err}`));
  }

  // Check for critical console errors
  const criticalErrors = consoleMessages.filter(msg =>
    msg.toLowerCase().includes('uncaught') ||
    msg.toLowerCase().includes('typeerror') ||
    msg.toLowerCase().includes('referenceerror')
  );

  if (criticalErrors.length > 0) {
    console.log('\n❌ Critical console errors:');
    criticalErrors.forEach(err => console.log(`  - ${err}`));
  } else {
    console.log('✅ No critical console errors');
  }

  console.log('\n=== Test Complete ===');
});
