---
name: testing-patterns
description: "RETA-specific Playwright testing patterns. Use when writing or debugging tests. Contains test mode setup, fixture usage, and common assertions."
---

# RETA Testing Patterns Skill

## Core Principle

**Tests run in a special "test mode" that bypasses Firebase auth.**

All tests use `?test=true` query parameter. Auth is mocked, not real.

## Test Mode Architecture

```
Normal Mode:
  User → Firebase Auth → Get Token → API Gateway → Lambda → DynamoDB

Test Mode (?test=true):
  User → Mock Auth → localStorage only (no cloud)
  - Firebase auth bypassed
  - API calls disabled
  - All data in localStorage
  - Deterministic, fast
```

## Test Organization

```
tests/
├── e2e/                    # End-to-end CRUD tests
│   ├── 01-injection-crud.spec.js
│   ├── 02-vial-crud.spec.js
│   ├── 07-weight-crud.spec.js
│   └── ...
├── integration/            # Feature integration
│   ├── app.spec.js
│   ├── results-redesign.spec.js
│   └── ...
├── sync/                   # Cloud sync tests
│   ├── offline-operations.spec.js
│   └── sync-queue.spec.js
├── edge-cases/            # Error handling
│   ├── corrupt-data.spec.js
│   └── validation.spec.js
├── performance/           # Large dataset tests
│   └── large-datasets.spec.js
├── smoke/                 # Pre-deploy sanity
│   └── pre-deploy.spec.js
├── helpers/               # Test utilities
│   ├── test-utils.js
│   ├── test-data-builder.js
│   └── assertions.js
└── fixtures/              # Test data
    └── test-data.js
```

## Running Tests

```bash
# All tests
npm test

# Single file
npm test -- tests/e2e/01-injection-crud.spec.js

# By pattern
npm test -- --grep "should add injection"

# With browser visible
npm run test:headed

# Debug mode (pause on failure)
npm run test:debug

# Generate report
npm run test:report
```

## Test Structure Pattern

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Feature Name', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate with test mode
    await page.goto('/?test=true');
    
    // Wait for app to initialize
    await page.waitForSelector('#app:not(.loading)');
    
    // Clear any existing data
    await page.evaluate(() => {
      localStorage.clear();
      location.reload();
    });
    await page.waitForSelector('#app:not(.loading)');
  });

  test('should do something', async ({ page }) => {
    // Arrange
    // ... setup

    // Act
    // ... perform action

    // Assert
    await expect(page.locator('.result')).toBeVisible();
  });
});
```

## Test Mode URL

**Always use `?test=true`:**

```javascript
// Correct:
await page.goto('/?test=true');
await page.goto('/?test=true#results');

// Wrong (will try real auth):
await page.goto('/');
```

## Common Test Patterns

### Navigate to Specific Page

```javascript
// Using hash navigation
await page.goto('/?test=true#injections');
await page.goto('/?test=true#vials');
await page.goto('/?test=true#weights');
await page.goto('/?test=true#results');
await page.goto('/?test=true#settings');

// Or click nav
await page.click('[data-nav="results"]');
```

### Add Test Data via localStorage

```javascript
await page.evaluate(() => {
  const data = {
    injections: [
      {
        id: 'test-inj-1',
        timestamp: Date.now(),
        dose_mg: 100,
        injection_site: 'left_thigh',
        vial_id: 'test-vial-1'
      }
    ],
    vials: [
      {
        id: 'test-vial-1',
        concentration_mg_ml: 200,
        initial_volume_ml: 1,
        current_volume_ml: 0.5
      }
    ],
    weights: [
      {
        id: 'test-weight-1',
        timestamp: Date.now(),
        weight_kg: 80
      }
    ],
    settings: {
      height_cm: 175
    }
  };
  localStorage.setItem('injectionTrackerData', JSON.stringify(data));
});

// Reload to apply
await page.reload();
await page.waitForSelector('#app:not(.loading)');
```

### Verify Data Persisted

```javascript
const savedData = await page.evaluate(() => {
  return JSON.parse(localStorage.getItem('injectionTrackerData'));
});

expect(savedData.injections).toHaveLength(1);
expect(savedData.injections[0].dose_mg).toBe(100);
```

### Form Interaction

```javascript
// Fill form
await page.fill('#dose-input', '100');
await page.selectOption('#site-select', 'left_thigh');
await page.selectOption('#vial-select', 'test-vial-1');

// Submit
await page.click('#add-injection-btn');

// Wait for update
await page.waitForSelector('.injection-item');
```

### Delete Item

```javascript
// Find and click delete
await page.click('.injection-item:first-child .delete-btn');

// Confirm if modal appears
const confirmBtn = page.locator('.confirm-delete-btn');
if (await confirmBtn.isVisible()) {
  await confirmBtn.click();
}

// Verify removed
await expect(page.locator('.injection-item')).toHaveCount(0);
```

### Chart Assertions

```javascript
// Wait for chart to render
await page.waitForSelector('canvas#weight-chart');

// Verify chart has data points
const chartData = await page.evaluate(() => {
  const chart = Chart.getChart('weight-chart');
  return chart.data.datasets[0].data;
});

expect(chartData).toHaveLength(5);
```

### Mobile Viewport (Default)

Tests run with iPhone 16 Pro viewport by default:

```javascript
// playwright.config.js already sets:
// viewport: { width: 402, height: 874 }

// For specific viewport needs:
test.use({ viewport: { width: 320, height: 568 } });
```

## Test Data Builder

Use `tests/helpers/test-data-builder.js`:

```javascript
const { TestDataBuilder } = require('./helpers/test-data-builder');

test('with builder', async ({ page }) => {
  const builder = new TestDataBuilder();
  
  const data = builder
    .withInjections(5)
    .withVials(2)
    .withWeights(10)
    .withSettings({ height_cm: 180 })
    .build();

  await page.evaluate((d) => {
    localStorage.setItem('injectionTrackerData', JSON.stringify(d));
  }, data);
});
```

## Assertions Helper

Use `tests/helpers/assertions.js`:

```javascript
const { assertDataPersisted, assertNoConsoleErrors } = require('./helpers/assertions');

test('data persists', async ({ page }) => {
  // ... actions

  await assertDataPersisted(page, {
    injections: 1,
    vials: 2
  });

  await assertNoConsoleErrors(page);
});
```

## Common Gotchas

### Wait for App Initialization

```javascript
// Always wait after navigation:
await page.goto('/?test=true');
await page.waitForSelector('#app:not(.loading)');
```

### Reload After localStorage Changes

```javascript
// Changes via evaluate need reload:
await page.evaluate(() => {
  // ... modify localStorage
});
await page.reload();
await page.waitForSelector('#app:not(.loading)');
```

### Handle Async Operations

```javascript
// Wait for network-like delays (even in test mode):
await page.waitForTimeout(100); // Debounce
await page.waitForSelector('.success-indicator');
```

### Form Validation Timing

```javascript
// Input validation may be async:
await page.fill('#input', 'value');
await page.waitForFunction(() => {
  const input = document.querySelector('#input');
  return input.validity.valid;
});
```

## Test Debugging

### Pause on Failure

```bash
npm run test:debug
```

### Capture Screenshot

```javascript
await page.screenshot({ path: 'debug.png' });
```

### Log Page Content

```javascript
console.log(await page.content());
```

### Check Console Errors

```javascript
page.on('console', msg => {
  if (msg.type() === 'error') {
    console.error('Browser error:', msg.text());
  }
});
```

## Anti-Patterns

- ❌ Using `page.goto('/')` without `?test=true`
- ❌ Not waiting for app initialization
- ❌ Assuming immediate localStorage persistence
- ❌ Hardcoded waits instead of proper selectors
- ❌ Not cleaning up data between tests
- ❌ Testing implementation details instead of behavior
