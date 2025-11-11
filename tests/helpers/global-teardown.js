/**
 * Global Teardown - Runs once after all tests
 *
 * Cleans up test environment and reports summary
 */

module.exports = async (config) => {
    console.log('\n=== Global Test Teardown ===');

    // Check for any test data leakage warnings
    const fs = require('fs');
    const path = require('path');

    // Read test results if available
    const resultsPath = path.join(process.cwd(), 'test-results', 'results.json');

    if (fs.existsSync(resultsPath)) {
        try {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
            const { stats } = results;

            console.log(`\nTest Summary:`);
            console.log(`  Total: ${stats.expected + stats.unexpected + stats.skipped}`);
            console.log(`  Passed: ${stats.expected}`);
            console.log(`  Failed: ${stats.unexpected}`);
            console.log(`  Skipped: ${stats.skipped}`);
            console.log(`  Duration: ${(stats.duration / 1000).toFixed(2)}s`);

            if (stats.unexpected > 0) {
                console.log(`\n⚠️  ${stats.unexpected} test(s) failed`);
                console.log(`   View report: test-results/html-report/index.html`);
            } else {
                console.log(`\n✓ All tests passed!`);
            }
        } catch (error) {
            console.log('Could not parse test results');
        }
    }

    console.log('\n=== Teardown Complete ===\n');
};
