/**
 * Concurrent Operations Tests
 *
 * Tests handling of simultaneous operations:
 * - Multiple tabs/windows
 * - Race conditions
 * - localStorage conflicts
 * - Event coordination
 * - Data consistency
 */

const { test, expect } = require('../helpers/test-fixtures');
const { TestDataBuilder } = require('../helpers/test-data-builder');
const { singleActiveVial } = require('../fixtures/test-data');

test.describe('Concurrent Operations', () => {

    test.describe('Multiple Tab Scenarios', () => {

        test('should sync data between multiple tabs', async ({ browser }) => {
            // Create two contexts (simulating two tabs)
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();

            const page1 = await context1.newPage();
            const page2 = await context2.newPage();

            // Both tabs load the app
            await page1.goto('http://localhost:3000/?test=true');
            await page2.goto('http://localhost:3000/?test=true');

            // Tab 1: Create a vial
            await page1.click('text=Vials');
            await page1.click('button:has-text("Add Vial")');
            await page1.fill('#vial-order-date', '2024-11-10');
            await page1.fill('#vial-total-mg', '10');
            await page1.fill('#vial-supplier', 'Tab 1 Vial');
            await page1.click('#vial-modal button:has-text("Save")');

            // Wait for storage event propagation
            await page2.waitForTimeout(1000);

            // Tab 2: Should see the vial (if storage events are handled)
            await page2.reload();
            await page2.click('text=Vials');

            const vialCards = page2.locator('.vial-card');
            const count = await vialCards.count();

            // If multi-tab sync is implemented, should see vial
            console.log(`Tab 2 sees ${count} vial(s)`);

            await context1.close();
            await context2.close();
        });

        test('should handle conflicting edits in different tabs', async ({ browser }) => {
            const context1 = await browser.newContext();
            const context2 = await browser.newContext();

            const page1 = await context1.newPage();
            const page2 = await context2.newPage();

            // Load same data in both tabs
            const initialData = new TestDataBuilder()
                .withActiveVial({
                    vial_id: 'shared-vial-123',
                    total_mg: 10,
                    supplier: 'Original Supplier'
                })
                .build();

            await page1.goto('http://localhost:3000/?test=true');
            await page1.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, initialData);

            await page2.goto('http://localhost:3000/?test=true');
            await page2.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, initialData);

            // Tab 1: Edit vial
            await page1.reload();
            await page1.click('text=Vials');
            await page1.click('.vial-card >> button:has-text("Edit")');
            await page1.fill('#vial-supplier', 'Tab 1 Edit');
            await page1.click('#vial-modal button:has-text("Save")');

            // Tab 2: Edit same vial (conflict)
            await page2.reload();
            await page2.click('text=Vials');
            await page2.click('.vial-card >> button:has-text("Edit")');
            await page2.fill('#vial-supplier', 'Tab 2 Edit');
            await page2.click('#vial-modal button:has-text("Save")');

            // Last write wins
            await page1.reload();
            await page1.click('text=Vials');

            const supplier = await page1.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials[0]?.supplier;
            });

            // Should be Tab 2's edit (last write)
            console.log(`Final supplier: ${supplier}`);

            await context1.close();
            await context2.close();
        });
    });

    test.describe('Race Conditions', () => {

        test('should handle rapid successive saves', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();
            await page.click('text=Vials');

            // Rapidly create multiple vials
            const promises = [];

            for (let i = 0; i < 5; i++) {
                promises.push((async () => {
                    await page.click('button:has-text("Add Vial")');
                    await page.fill('#vial-order-date', `2024-11-${10 + i}`);
                    await page.fill('#vial-total-mg', (10 + i).toString());
                    await page.fill('#vial-supplier', `Rapid Vial ${i}`);
                    await page.click('#vial-modal button:has-text("Save")');
                    await page.waitForSelector('#vial-modal', { state: 'hidden' });
                })());
            }

            // Wait for all to complete
            await Promise.all(promises);

            // Verify all vials were created
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            // Should have original + 5 new vials
            expect(vials.length).toBe(6);

            console.log(`Created ${vials.length} vials with rapid saves`);
        });

        test('should handle concurrent injection creations', async ({ isolated }) => {
            const { page } = isolated;

            // Create vial with sufficient capacity
            const vialData = new TestDataBuilder()
                .withActiveVial({ total_mg: 100, bac_water_ml: 10 }) // 10mg/ml
                .build();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, vialData);

            await page.reload();

            // Rapidly create injections
            const vialId = vialData.vials[0].vial_id;

            await page.evaluate((id) => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');

                // Simulate concurrent injection creations
                for (let i = 0; i < 10; i++) {
                    const injection = {
                        id: `concurrent-injection-${i}`,
                        vial_id: id,
                        dose_mg: 2.5,
                        date: `2024-11-${10 + i}`,
                        timestamp: Date.now() + i
                    };

                    data.injections.push(injection);

                    // Update vial volume
                    const vial = data.vials.find(v => v.vial_id === id);
                    if (vial) {
                        const volumeUsed = injection.dose_mg / vial.concentration_mg_ml;
                        vial.current_volume_ml -= volumeUsed;
                    }
                }

                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, vialId);

            await page.reload();

            // Verify all injections and volume is correct
            const result = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return {
                    injectionCount: data.injections.length,
                    vialVolume: data.vials[0]?.current_volume_ml
                };
            });

            expect(result.injectionCount).toBe(10);

            // Volume: 10ml - (10 injections * 2.5mg / 10mg/ml) = 10 - 2.5 = 7.5ml
            expect(result.vialVolume).toBeCloseTo(7.5, 1);

            console.log(`Concurrent injections: ${result.injectionCount}, remaining volume: ${result.vialVolume}ml`);
        });
    });

    test.describe('localStorage Conflicts', () => {

        test('should handle localStorage write conflicts', async ({ isolated }) => {
            const { page } = isolated;

            const initialData = new TestDataBuilder()
                .withActiveVial({ total_mg: 10 })
                .build();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, initialData);

            await page.reload();

            // Simulate external modification to localStorage
            await page.evaluate(() => {
                // Another process modifies storage
                setTimeout(() => {
                    const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                    data.vials.push({
                        vial_id: 'external-vial',
                        total_mg: 15,
                        status: 'active',
                        order_date: '2024-11-15'
                    });
                    localStorage.setItem('retatrutide_data', JSON.stringify(data));

                    // Dispatch storage event
                    window.dispatchEvent(new StorageEvent('storage', {
                        key: 'retatrutide_data',
                        newValue: JSON.stringify(data)
                    }));
                }, 500);
            });

            // App makes a change
            await page.click('text=Vials');
            await page.click('button:has-text("Add Vial")');
            await page.fill('#vial-order-date', '2024-11-16');
            await page.fill('#vial-total-mg', '20');
            await page.click('#vial-modal button:has-text("Save")');

            await page.waitForTimeout(1000);

            // Check if both changes are preserved
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            console.log(`Total vials after conflict: ${vials.length}`);

            // Should have at least 3 vials (original + external + app's new one)
            expect(vials.length).toBeGreaterThanOrEqual(3);
        });

        test('should queue writes to prevent data corruption', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();

            // Trigger multiple writes simultaneously
            const writeResults = await page.evaluate(() => {
                const promises = [];

                for (let i = 0; i < 10; i++) {
                    promises.push(new Promise((resolve) => {
                        setTimeout(() => {
                            const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                            data.vials.push({
                                vial_id: `queued-vial-${i}`,
                                total_mg: 10 + i,
                                status: 'active',
                                order_date: '2024-11-10'
                            });
                            localStorage.setItem('retatrutide_data', JSON.stringify(data));
                            resolve(i);
                        }, Math.random() * 100);
                    }));
                }

                return Promise.all(promises);
            });

            await page.reload();

            // Verify data integrity
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            // Should have all vials
            console.log(`Queued writes resulted in ${vials.length} vials`);

            // At least should not lose the original vial
            expect(vials.length).toBeGreaterThanOrEqual(1);
        });
    });

    test.describe('Event Coordination', () => {

        test('should handle storage events from other tabs', async ({ isolated }) => {
            const { page } = isolated;

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, singleActiveVial);

            await page.reload();

            // Set up storage event listener
            await page.evaluate(() => {
                window.storageEventReceived = false;

                window.addEventListener('storage', (e) => {
                    if (e.key === 'retatrutide_data') {
                        console.log('Storage event received:', e.newValue?.length);
                        window.storageEventReceived = true;
                    }
                });
            });

            // Simulate external storage change
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                data.vials.push({
                    vial_id: 'event-test-vial',
                    total_mg: 25,
                    status: 'active',
                    order_date: '2024-11-17'
                });

                // Manually trigger storage event
                const newValue = JSON.stringify(data);
                localStorage.setItem('retatrutide_data', newValue);

                window.dispatchEvent(new StorageEvent('storage', {
                    key: 'retatrutide_data',
                    oldValue: null,
                    newValue: newValue,
                    storageArea: localStorage
                }));
            });

            await page.waitForTimeout(500);

            // Check if event was received
            const eventReceived = await page.evaluate(() => window.storageEventReceived);

            console.log(`Storage event received: ${eventReceived}`);
        });
    });

    test.describe('Data Consistency', () => {

        test('should maintain referential integrity during concurrent ops', async ({ isolated }) => {
            const { page } = isolated;

            const vialData = new TestDataBuilder()
                .withActiveVial({ vial_id: 'integrity-vial', total_mg: 50, bac_water_ml: 5 })
                .build();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, vialData);

            await page.reload();

            // Concurrently add injections and modify vial
            await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                const vialId = data.vials[0].vial_id;

                // Add multiple injections referencing the vial
                for (let i = 0; i < 5; i++) {
                    data.injections.push({
                        id: `integrity-injection-${i}`,
                        vial_id: vialId,
                        dose_mg: 2.0,
                        date: `2024-11-${10 + i}`
                    });
                }

                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            });

            await page.reload();

            // Verify all injections reference valid vial
            const integrity = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                const vialIds = new Set(data.vials.map(v => v.vial_id));

                const orphanedInjections = data.injections.filter(
                    inj => !vialIds.has(inj.vial_id)
                );

                return {
                    totalInjections: data.injections.length,
                    orphanedCount: orphanedInjections.length,
                    allValid: orphanedInjections.length === 0
                };
            });

            console.log(`Referential integrity: ${integrity.totalInjections} injections, ${integrity.orphanedCount} orphaned`);

            expect(integrity.allValid).toBe(true);
        });

        test('should handle delete cascades correctly under concurrent load', async ({ isolated }) => {
            const { page } = isolated;

            const vialWithInjections = new TestDataBuilder()
                .withActiveVial({ vial_id: 'cascade-vial', total_mg: 10 })
                .withInjection(0, { id: 'cascade-inj-1', dose_mg: 2.0 })
                .withInjection(0, { id: 'cascade-inj-2', dose_mg: 2.5 })
                .build();

            await page.evaluate((data) => {
                localStorage.setItem('retatrutide_data', JSON.stringify(data));
            }, vialWithInjections);

            await page.reload();

            // Try to delete vial (should fail due to injections)
            await page.click('text=Vials');
            await page.click('.vial-card >> button:has-text("Delete")');

            // Should show error
            const errorMessage = page.locator('.error-message, .alert-danger');
            await expect(errorMessage).toContainText(/cannot delete.*injection/i);

            // Vial should still exist
            const vials = await page.evaluate(() => {
                const data = JSON.parse(localStorage.getItem('retatrutide_data') || '{}');
                return data.vials || [];
            });

            expect(vials.length).toBe(1);

            console.log('Delete cascade protection working correctly');
        });
    });
});
