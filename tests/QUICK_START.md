# Test Suite Quick Start Guide

## 🚀 30-Second Start

```bash
# Install & run
npm install
npm test
```

That's it! Tests run with complete isolation, automatic cleanup, and zero network calls.

---

## 📖 5-Minute Tutorial

### 1. Run Tests by Category

```bash
npm run test:integration  # Feature tests
npm run test:sync         # Sync simulation
npm run test:edge         # Edge cases
npm run test:perf         # Performance
```

### 2. Write Your First Test

Create `tests/my-test.spec.js`:

```javascript
const { test, expect } = require('./helpers/test-fixtures');
const { singleActiveVial } = require('./fixtures/test-data');

test('should create an injection', async ({ isolated }) => {
    const { page } = isolated;

    // Load test data
    await page.evaluate((data) => {
        localStorage.setItem('retatrutide_data', JSON.stringify(data));
    }, singleActiveVial);

    // Add injection
    await page.click('button:has-text("Add Injection")');
    await page.fill('#injection-dose-mg', '2.5');
    await page.click('button:has-text("Save")');

    // Verify
    const injections = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
        return data.injections || [];
    });

    expect(injections.length).toBe(1);

    // ✨ Automatic cleanup - done!
});
```

### 3. Run Your Test

```bash
npx playwright test tests/my-test.spec.js --headed
```

---

## 🎯 Common Patterns

### Pattern 1: Basic CRUD Test

```javascript
test('should create/read/update/delete vial', async ({ isolated }) => {
    const { page } = isolated;

    // CREATE
    await page.click('text=Vials');
    await page.click('button:has-text("Add Vial")');
    await page.fill('#vial-total-mg', '10');
    await page.click('button:has-text("Save")');

    // READ
    const vialCard = page.locator('.vial-card').first();
    await expect(vialCard).toBeVisible();

    // UPDATE
    await vialCard.click();
    await page.fill('#vial-total-mg', '15');
    await page.click('button:has-text("Save")');

    // DELETE
    await page.click('button:has-text("Delete")');

    // ✅ Automatic rollback!
});
```

### Pattern 2: Using Test Data Builder

```javascript
const { TestDataBuilder } = require('./helpers/test-data-builder');

test('should handle multiple injections', async ({ isolated }) => {
    const { page } = isolated;

    const testData = new TestDataBuilder()
        .withActiveVial({ total_mg: 10 })
        .withInjection(0, { dose_mg: 2.0 })
        .withInjection(0, { dose_mg: 2.5 })
        .build();

    await page.evaluate((data) => {
        localStorage.setItem('retatrutide_data', JSON.stringify(data));
    }, testData);

    // Test operations...
});
```

### Pattern 3: Using Custom Assertions

```javascript
test('should update vial volume correctly', async ({ isolated }) => {
    const { page } = isolated;

    // ... create injection ...

    // Custom assertions
    await expect(page).toHaveVial('vial-id', { status: 'active' });
    await expect(page).toHaveVialVolume('vial-id', 0.75, 0.01);
    await expect(page).toHaveInjection('injection-id', { dose_mg: 2.5 });
});
```

### Pattern 4: Offline Operations

```javascript
test('should work offline', async ({ isolated }) => {
    const { page } = isolated;

    // Go offline
    await page.context().setOffline(true);

    // Operations still work!
    await page.click('button:has-text("Add Vial")');
    await page.fill('#vial-total-mg', '10');
    await page.click('button:has-text("Save")');

    // Verify queued for sync
    const syncQueue = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
        return data.syncQueue || [];
    });

    expect(syncQueue.length).toBeGreaterThan(0);
});
```

### Pattern 5: Performance Testing

```javascript
const { createLargeDataset } = require('./fixtures/test-data');

test('should handle large dataset', async ({ isolated }) => {
    const { page } = isolated;

    const largeData = createLargeDataset(100, 50, 200);
    // 100 vials, 50 injections per vial, 200 weights

    const startTime = Date.now();

    await page.evaluate((data) => {
        localStorage.setItem('retatrutide_data', JSON.stringify(data));
    }, largeData);

    await page.reload();

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000); // <5s
});
```

---

## 🧰 Essential Commands

```bash
# Run all tests
npm test

# Run with browser visible
npm run test:headed

# Debug specific test
npx playwright test path/to/test.spec.js --debug

# Run specific test by name
npx playwright test -g "should create an injection"

# View test report
npm run test:report

# Run in CI mode
CI=true npm test
```

---

## 🎓 Key Concepts

### 1. The `isolated` Fixture

The magic that makes everything work:

```javascript
test('example', async ({ isolated }) => {
    const { page, transaction } = isolated;
    // Includes:
    // ✅ Test mode (?test=true)
    // ✅ API mocking (no network)
    // ✅ Transaction rollback
    // ✅ Automatic cleanup
});
```

### 2. Test Data Fixtures

Pre-built scenarios for common cases:

```javascript
const {
    singleActiveVial,           // Basic active vial
    vialWithMultipleInjections, // Vial + 3 injections
    weightLossJourney,          // 8-week progression
    createLargeDataset          // Performance testing
} = require('./fixtures/test-data');
```

### 3. Custom Assertions

Make tests readable:

```javascript
// Instead of:
const vial = await page.evaluate(/* complex query */);
expect(vial.status).toBe('active');

// Use:
await expect(page).toHaveVial('vial-id', { status: 'active' });
```

---

## 🐛 Debugging Tips

### Problem: Test is failing

```bash
# Run with browser visible
npm run test:headed

# Or use debug mode
npx playwright test path/to/test.spec.js --debug
```

### Problem: Need to see what's happening

```javascript
test('example', async ({ isolated }) => {
    const { page } = isolated;

    // Enable console logs
    page.on('console', msg => console.log('PAGE:', msg.text()));

    // Take screenshot
    await page.screenshot({ path: 'debug.png' });

    // Pause execution
    await page.pause();
});
```

### Problem: API calls are happening

```javascript
test('example', async ({ isolated, apiMock }) => {
    const { page } = isolated;

    // Verify no API calls
    await apiMock.verify(); // Throws if real calls happened
});
```

---

## 📚 Next Steps

1. **Read full documentation:** [tests/README.md](README.md)
2. **Study examples:** [tests/integration/example-with-fixtures.spec.js](integration/example-with-fixtures.spec.js)
3. **Review test organization:** [tests/REORGANIZATION_PLAN.md](REORGANIZATION_PLAN.md)
4. **Check summary:** [tests/TEST_SUITE_SUMMARY.md](TEST_SUITE_SUMMARY.md)

---

## 💡 Pro Tips

### Tip 1: Use Test Data Builder for Complex Scenarios

```javascript
const testData = new TestDataBuilder()
    .withActiveVial({ total_mg: 10 })
    .withInjection(0, { dose_mg: 2.0, daysAgo: 7 })
    .withInjection(0, { dose_mg: 2.5, daysAgo: 14 })
    .withWeight({ weightKg: 90.5, daysAgo: 0 })
    .build();
```

### Tip 2: Run Specific Category in Watch Mode

```bash
# Re-run tests on file change
npx playwright test tests/integration --watch
```

### Tip 3: Generate Test Code

```bash
# Record actions and generate test code
npx playwright codegen localhost:3000/?test=true
```

### Tip 4: Parallel Execution

```bash
# Run tests in parallel (configured: 3 workers)
npm test

# Override worker count
npx playwright test --workers=5
```

### Tip 5: Filter by Test Name

```bash
# Run only tests matching pattern
npx playwright test -g "should create"

# Exclude tests matching pattern
npx playwright test --grep-invert "slow"
```

---

## ✅ Checklist for New Tests

- [ ] Use `isolated` fixture for isolation
- [ ] Use `TestDataBuilder` or predefined fixtures
- [ ] Use custom assertions where applicable
- [ ] Verify no API calls with `apiMock.verify()`
- [ ] Add descriptive test names
- [ ] Document complex test logic
- [ ] Check test runs <60s (default timeout)
- [ ] Verify cleanup with `verifyNoTestDataRemains()`

---

## 🎉 You're Ready!

You now have everything you need to:
- ✅ Write isolated, clean tests
- ✅ Test all CRUD operations
- ✅ Simulate sync scenarios
- ✅ Handle edge cases
- ✅ Test performance

**Happy testing! 🚀**

---

*Need help? Check [tests/README.md](README.md) for comprehensive documentation.*
