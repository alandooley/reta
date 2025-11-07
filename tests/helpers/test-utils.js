/**
 * Test Utilities
 * Shared helper functions for Playwright tests
 */

/**
 * Clear all localStorage data
 * @param {Page} page - Playwright page object
 */
async function clearAllStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Get localStorage data
 * @param {Page} page - Playwright page object
 * @param {string} key - Storage key
 * @returns {Promise<any>} Parsed JSON data
 */
async function getLocalStorage(page, key) {
  return await page.evaluate((storageKey) => {
    const data = localStorage.getItem(storageKey);
    return data ? JSON.parse(data) : null;
  }, key);
}

/**
 * Set localStorage data
 * @param {Page} page - Playwright page object
 * @param {string} key - Storage key
 * @param {any} value - Data to store (will be JSON.stringified)
 */
async function setLocalStorage(page, key, value) {
  await page.evaluate(({ storageKey, storageValue }) => {
    localStorage.setItem(storageKey, JSON.stringify(storageValue));
  }, { storageKey: key, storageValue: value });
}

/**
 * Load test data into localStorage
 * @param {Page} page - Playwright page object
 * @param {Object} data - Test dataset with injections, vials, weights, settings
 */
async function loadTestData(page, data) {
  const appData = {
    injections: data.injections || [],
    vials: data.vials || [],
    weights: data.weights || [],
    settings: data.settings || {}
  };

  await setLocalStorage(page, 'injectionTrackerData', appData);
}

/**
 * Wait for app to be fully loaded and initialized
 * @param {Page} page - Playwright page object
 */
async function waitForAppReady(page) {
  // Wait for the app object to be available
  await page.waitForFunction(() => {
    return typeof window.app !== 'undefined' && window.app !== null;
  }, { timeout: 5000 });

  // Wait for the tabs to be rendered
  await page.waitForSelector('.nav-tabs', { timeout: 5000 });
}

/**
 * Navigate to a specific tab
 * @param {Page} page - Playwright page object
 * @param {string} tabName - Tab name ('shots', 'inventory', 'results', 'settings')
 */
async function navigateToTab(page, tabName) {
  await page.click(`button[onclick="app.switchTab('${tabName}')"]`);
  await page.waitForSelector(`#${tabName}-tab.active`, { timeout: 2000 });
}

/**
 * Open a modal by clicking a button
 * @param {Page} page - Playwright page object
 * @param {string} selector - Button selector
 */
async function openModal(page, selector) {
  await page.click(selector);
  await page.waitForSelector('.modal.show', { timeout: 2000 });
}

/**
 * Close currently open modal
 * @param {Page} page - Playwright page object
 */
async function closeModal(page) {
  // Try clicking the close button
  const closeButton = await page.$('.modal.show .btn-close');
  if (closeButton) {
    await closeButton.click();
  } else {
    // Try clicking cancel button
    const cancelButton = await page.$('.modal.show button:has-text("Cancel")');
    if (cancelButton) {
      await cancelButton.click();
    }
  }

  // Wait for modal to be hidden
  await page.waitForSelector('.modal.show', { state: 'hidden', timeout: 2000 });
}

/**
 * Fill a form input field
 * @param {Page} page - Playwright page object
 * @param {string} selector - Input selector
 * @param {string|number} value - Value to fill
 */
async function fillInput(page, selector, value) {
  await page.fill(selector, String(value));
}

/**
 * Select an option from a dropdown
 * @param {Page} page - Playwright page object
 * @param {string} selector - Select element selector
 * @param {string} value - Option value
 */
async function selectOption(page, selector, value) {
  await page.selectOption(selector, value);
}

/**
 * Submit a form
 * @param {Page} page - Playwright page object
 * @param {string} formSelector - Form selector
 */
async function submitForm(page, formSelector) {
  await page.click(`${formSelector} button[type="submit"]`);
}

/**
 * Wait for a toast/notification message
 * @param {Page} page - Playwright page object
 * @param {string} expectedText - Expected message text (partial match)
 * @returns {Promise<boolean>} True if message appeared
 */
async function waitForNotification(page, expectedText) {
  try {
    await page.waitForSelector(`.toast:has-text("${expectedText}")`, { timeout: 3000 });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get all injections from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of injection objects
 */
async function getInjections(page) {
  const data = await getLocalStorage(page, 'injectionTrackerData');
  return data?.injections || [];
}

/**
 * Get all vials from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of vial objects
 */
async function getVials(page) {
  const data = await getLocalStorage(page, 'injectionTrackerData');
  return data?.vials || [];
}

/**
 * Get all weights from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of weight objects
 */
async function getWeights(page) {
  const data = await getLocalStorage(page, 'injectionTrackerData');
  return data?.weights || [];
}

/**
 * Get settings from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Settings object
 */
async function getSettings(page) {
  const data = await getLocalStorage(page, 'injectionTrackerData');
  return data?.settings || {};
}

/**
 * Get sync queue from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Array>} Array of queued operations
 */
async function getSyncQueue(page) {
  return await getLocalStorage(page, 'sync_queue') || [];
}

/**
 * Get pending deletions from localStorage
 * @param {Page} page - Playwright page object
 * @returns {Promise<Object>} Pending deletions object
 */
async function getPendingDeletions(page) {
  return await getLocalStorage(page, 'pending_deletions') || {};
}

/**
 * Count visible rows in a table
 * @param {Page} page - Playwright page object
 * @param {string} tableSelector - Table selector
 * @returns {Promise<number>} Number of visible rows
 */
async function countTableRows(page, tableSelector) {
  const rows = await page.$$(`${tableSelector} tbody tr:not(.empty-state)`);
  return rows.length;
}

/**
 * Wait for a specific number of table rows
 * @param {Page} page - Playwright page object
 * @param {string} tableSelector - Table selector
 * @param {number} expectedCount - Expected row count
 * @param {number} timeout - Timeout in ms (default 5000)
 */
async function waitForTableRows(page, tableSelector, expectedCount, timeout = 5000) {
  await page.waitForFunction(
    ({ selector, count }) => {
      const rows = document.querySelectorAll(`${selector} tbody tr:not(.empty-state)`);
      return rows.length === count;
    },
    { selector: tableSelector, count: expectedCount },
    { timeout }
  );
}

/**
 * Check if validation indicator shows success
 * @param {Page} page - Playwright page object
 * @param {string} indicatorId - Validation indicator ID
 * @returns {Promise<boolean>} True if shows success state
 */
async function hasValidationSuccess(page, indicatorId) {
  const indicator = await page.$(`#${indicatorId} .validation-success`);
  return indicator !== null;
}

/**
 * Check if validation indicator shows warning
 * @param {Page} page - Playwright page object
 * @param {string} indicatorId - Validation indicator ID
 * @returns {Promise<boolean>} True if shows warning state
 */
async function hasValidationWarning(page, indicatorId) {
  const indicator = await page.$(`#${indicatorId} .validation-warning`);
  return indicator !== null;
}

/**
 * Check if validation indicator shows error
 * @param {Page} page - Playwright page object
 * @param {string} indicatorId - Validation indicator ID
 * @returns {Promise<boolean>} True if shows error state
 */
async function hasValidationError(page, indicatorId) {
  const indicator = await page.$(`#${indicatorId} .validation-error`);
  return indicator !== null;
}

/**
 * Get validation tooltip text
 * @param {Page} page - Playwright page object
 * @param {string} indicatorId - Validation indicator ID
 * @returns {Promise<string|null>} Tooltip text or null
 */
async function getValidationTooltip(page, indicatorId) {
  const tooltip = await page.$(`#${indicatorId} .tooltip-content`);
  if (tooltip) {
    return await tooltip.textContent();
  }
  return null;
}

/**
 * Reload page and wait for app to be ready
 * @param {Page} page - Playwright page object
 */
async function reloadPage(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await waitForAppReady(page);
}

/**
 * Take screenshot with timestamp
 * @param {Page} page - Playwright page object
 * @param {string} name - Screenshot name (without extension)
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `test-results/screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Assert that two objects are deeply equal (for test data comparison)
 * @param {any} actual - Actual value
 * @param {any} expected - Expected value
 * @param {string} message - Assertion message
 */
function assertDeepEqual(actual, expected, message = '') {
  const actualStr = JSON.stringify(actual, null, 2);
  const expectedStr = JSON.stringify(expected, null, 2);

  if (actualStr !== expectedStr) {
    throw new Error(
      `${message}\nExpected:\n${expectedStr}\nActual:\n${actualStr}`
    );
  }
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Condition function that returns boolean
 * @param {number} timeout - Timeout in ms (default 5000)
 * @param {number} interval - Check interval in ms (default 100)
 */
async function waitForCondition(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

// Export all utilities
module.exports = {
  clearAllStorage,
  getLocalStorage,
  setLocalStorage,
  loadTestData,
  waitForAppReady,
  navigateToTab,
  openModal,
  closeModal,
  fillInput,
  selectOption,
  submitForm,
  waitForNotification,
  getInjections,
  getVials,
  getWeights,
  getSettings,
  getSyncQueue,
  getPendingDeletions,
  countTableRows,
  waitForTableRows,
  hasValidationSuccess,
  hasValidationWarning,
  hasValidationError,
  getValidationTooltip,
  reloadPage,
  takeScreenshot,
  assertDeepEqual,
  waitForCondition
};
