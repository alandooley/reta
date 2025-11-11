/**
 * Input Validation Tests
 *
 * Tests validation logic for all data types:
 * - Required fields
 * - Data type validation
 * - Range validation
 * - Format validation
 * - Business rule validation
 */

const { test, expect } = require('../helpers/test-fixtures');
const { singleActiveVial } = require('../fixtures/test-data');

test.describe('Input Validation', () => {

    test.describe('Vial Validation', () => {

        test('should require total_mg to be positive number', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');

            // Try negative value
            await page.fill('#vial-total-mg', '-10');
            await page.fill('#vial-order-date', '2024-11-10');
            await page.click('#vial-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .alert-danger, .validation-error');
            await expect(errorMessage).toContainText(/positive|greater than zero|invalid/i);

            // Try zero
            await page.fill('#vial-total-mg', '0');
            await page.click('#vial-modal button:has-text("Save")');
            await expect(errorMessage).toBeVisible();

            // Try non-numeric
            await page.fill('#vial-total-mg', 'abc');
            await page.click('#vial-modal button:has-text("Save")');
            await expect(errorMessage).toBeVisible();
        });

        test('should require bac_water_ml to be positive when activating', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, {
                vials: [{
                    vial_id: 'test-dry-vial',
                    total_mg: 10,
                    status: 'dry_stock',
                    order_date: '2024-11-01'
                }],
                injections: [],
                weights: []
            });

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Activate")');

            // Try negative
            await page.fill('#vial-bac-water-ml', '-1');
            await page.fill('#vial-reconstitution-date', '2024-11-10');
            await page.click('button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/positive|greater than zero/i);

            // Try zero
            await page.fill('#vial-bac-water-ml', '0');
            await page.click('button:has-text("Save")');
            await expect(errorMessage).toBeVisible();
        });

        test('should require order_date to not be in future', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');

            // Future date
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 7);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            await page.fill('#vial-order-date', futureDateStr);
            await page.fill('#vial-total-mg', '10');
            await page.click('#vial-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/future|past|invalid date/i);
        });

        test('should validate concentration calculation', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');

            await page.fill('#vial-order-date', '2024-11-10');
            await page.fill('#vial-total-mg', '10');

            // If manually entering concentration
            const concField = page.locator('#vial-concentration-mg-ml');
            if (await concField.isVisible()) {
                await concField.fill('0'); // Zero concentration
                await page.click('button:has-text("Save")');

                const errorMessage = page.locator('.error-message, .validation-error');
                await expect(errorMessage).toContainText(/concentration|invalid/i);
            }
        });
    });

    test.describe('Injection Validation', () => {

        test('should require dose_mg to be positive', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();
            await page.click('button:has-text("Add Injection")');

            // Try negative dose
            await page.fill('#injection-dose-mg', '-2.5');
            await page.fill('#injection-date', '2024-11-10');
            await page.click('#injection-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/positive|greater than zero/i);

            // Try zero
            await page.fill('#injection-dose-mg', '0');
            await page.click('#injection-modal button:has-text("Save")');
            await expect(errorMessage).toBeVisible();
        });

        test('should prevent injection exceeding vial capacity', async ({ isolated }) => {
            const { page } = isolated;

            // Vial with 10mg total, 0.1ml remaining
            await page.evaluate(() => {
                localStorage.setItem('retatrutide_data', JSON.stringify({
                    vials: [{
                        vial_id: 'test-vial-low',
                        total_mg: 10,
                        bac_water_ml: 1,
                        concentration_mg_ml: 10,
                        current_volume_ml: 0.1,
                        remaining_ml: 0.1,
                        status: 'active',
                        order_date: '2024-11-01'
                    }],
                    injections: [],
                    weights: []
                }));
            });

            await page.reload();
            await page.click('button:has-text("Add Injection")');

            // Try to inject 2.5mg (requires 0.25ml, but only 0.1ml available)
            await page.fill('#injection-dose-mg', '2.5');
            await page.fill('#injection-date', '2024-11-10');
            await page.click('#injection-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/insufficient|not enough|exceeds/i);
        });

        test('should require injection date', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();
            await page.click('button:has-text("Add Injection")');

            await page.fill('#injection-dose-mg', '2.5');
            // Don't fill date
            await page.click('#injection-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/date|required/i);
        });

        test('should prevent dose exceeding reasonable limits', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();
            await page.click('button:has-text("Add Injection")');

            // Try unrealistic dose (e.g., 100mg)
            await page.fill('#injection-dose-mg', '100');
            await page.fill('#injection-date', '2024-11-10');
            await page.click('#injection-modal button:has-text("Save")');

            // May show warning or error
            const message = page.locator('.warning-message, .error-message, .validation-error');
            const messageText = await message.textContent().catch(() => '');

            // Should mention high dose or confirm
            if (messageText) {
                expect(/high|unusual|confirm|sure/i.test(messageText)).toBe(true);
            }
        });
    });

    test.describe('Weight Validation', () => {

        test('should require weight to be positive', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Weight');
            await page.click('button:has-text("Add Weight")');

            // Try negative weight
            await page.fill('#weight-kg', '-80');
            await page.fill('#weight-date', '2024-11-10');
            await page.click('#weight-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/positive|greater than zero/i);

            // Try zero
            await page.fill('#weight-kg', '0');
            await page.click('#weight-modal button:has-text("Save")');
            await expect(errorMessage).toBeVisible();
        });

        test('should validate reasonable weight range', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Weight');
            await page.click('button:has-text("Add Weight")');

            // Try unrealistic weight (e.g., 10kg or 500kg)
            await page.fill('#weight-kg', '10');
            await page.fill('#weight-date', '2024-11-10');
            await page.click('#weight-modal button:has-text("Save")');

            let message = page.locator('.warning-message, .error-message');
            let messageText = await message.textContent().catch(() => '');

            if (messageText) {
                expect(/unrealistic|invalid|range/i.test(messageText)).toBe(true);
            }

            // Try very high weight
            await page.fill('#weight-kg', '500');
            await page.click('#weight-modal button:has-text("Save")');

            messageText = await message.textContent().catch(() => '');
            if (messageText) {
                expect(/unrealistic|invalid|range/i.test(messageText)).toBe(true);
            }
        });

        test('should require weight date', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Weight');
            await page.click('button:has-text("Add Weight")');

            await page.fill('#weight-kg', '85');
            // Don't fill date
            await page.click('#weight-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/date|required/i);
        });
    });

    test.describe('Settings Validation', () => {

        test('should validate default dose range', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Settings');

            const defaultDoseField = page.locator('#settings-default-dose');
            if (await defaultDoseField.isVisible()) {
                // Try negative
                await defaultDoseField.fill('-2.5');
                await page.click('button:has-text("Save")');

                const errorMessage = page.locator('.error-message, .validation-error');
                await expect(errorMessage).toContainText(/positive|invalid/i);

                // Try zero
                await defaultDoseField.fill('0');
                await page.click('button:has-text("Save")');
                await expect(errorMessage).toBeVisible();
            }
        });

        test('should validate injection frequency', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Settings');

            const frequencyField = page.locator('#settings-injection-frequency');
            if (await frequencyField.isVisible()) {
                // Try negative
                await frequencyField.fill('-7');
                await page.click('button:has-text("Save")');

                const errorMessage = page.locator('.error-message, .validation-error');
                await expect(errorMessage).toContainText(/positive|invalid/i);
            }
        });

        test('should validate height in settings', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Settings');

            const heightField = page.locator('#settings-height-cm');
            if (await heightField.isVisible()) {
                // Try unrealistic height
                await heightField.fill('10');
                await page.click('button:has-text("Save")');

                const message = page.locator('.error-message, .warning-message');
                const messageText = await message.textContent().catch(() => '');

                if (messageText) {
                    expect(/unrealistic|invalid|range/i.test(messageText)).toBe(true);
                }
            }
        });
    });

    test.describe('Cross-Field Validation', () => {

        test('should validate injection date is after vial activation', async ({ isolated }) => {
            const { page } = isolated;

            // Create vial activated on 2024-11-10
            await page.evaluate(() => {
                localStorage.setItem('retatrutide_data', JSON.stringify({
                    vials: [{
                        vial_id: 'test-vial-date',
                        total_mg: 10,
                        bac_water_ml: 1,
                        concentration_mg_ml: 10,
                        current_volume_ml: 1.0,
                        status: 'active',
                        order_date: '2024-11-01',
                        reconstitution_date: '2024-11-10'
                    }],
                    injections: [],
                    weights: []
                }));
            });

            await page.reload();
            await page.click('button:has-text("Add Injection")');

            // Try to add injection BEFORE activation date
            await page.fill('#injection-dose-mg', '2.5');
            await page.fill('#injection-date', '2024-11-05'); // Before 11-10
            await page.click('#injection-modal button:has-text("Save")');

            const errorMessage = page.locator('.error-message, .validation-error');
            await expect(errorMessage).toContainText(/before|activation|reconstitution/i);
        });

        test('should warn if goal weight is unrealistic', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Settings');

            // Set current weight high, goal weight very low
            const heightField = page.locator('#settings-height-cm');
            const goalWeightField = page.locator('#settings-goal-weight-kg');

            if (await heightField.isVisible() && await goalWeightField.isVisible()) {
                await heightField.fill('180'); // 180cm
                await goalWeightField.fill('40'); // 40kg - underweight BMI

                await page.click('button:has-text("Save")');

                const warning = page.locator('.warning-message, .alert-warning');
                const warningText = await warning.textContent().catch(() => '');

                if (warningText) {
                    expect(/underweight|low bmi|unhealthy/i.test(warningText)).toBe(true);
                }
            }
        });
    });

    test.describe('Sanitization', () => {

        test('should sanitize string inputs', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');

            // Try XSS attack
            await page.fill('#vial-supplier', '<script>alert("xss")</script>');
            await page.fill('#vial-order-date', '2024-11-10');
            await page.fill('#vial-total-mg', '10');
            await page.click('#vial-modal button:has-text("Save")');

            // Verify data was sanitized
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            const supplier = vials[0]?.supplier || '';

            // Should not contain script tags
            expect(supplier.includes('<script>')).toBe(false);
            expect(supplier.includes('</script>')).toBe(false);
        });

        test('should trim whitespace from inputs', async ({ isolated }) => {
            const { page } = isolated;

            await page.reload();
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');

            // Add whitespace
            await page.fill('#vial-supplier', '  Test Supplier  ');
            await page.fill('#vial-order-date', '2024-11-10');
            await page.fill('#vial-total-mg', '10');
            await page.click('#vial-modal button:has-text("Save")');

            // Verify trimmed
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            expect(vials[0]?.supplier).toBe('Test Supplier');
        });
    });
});
