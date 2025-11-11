/**
 * Global Setup - Runs once before all tests
 *
 * Prepares test environment and validates configuration
 */

module.exports = async (config) => {
    console.log('\n=== Global Test Setup ===');
    console.log(`Running tests in ${process.env.CI ? 'CI' : 'local'} mode`);

    const baseURL = config.use?.baseURL || 'http://localhost:3000';
    const workers = config.workers || 3;

    console.log(`Base URL: ${baseURL}`);
    console.log(`Workers: ${workers}`);
    console.log(`Test mode: ?test=true will bypass authentication`);

    // Validate test environment
    const isLocalhost = baseURL.includes('localhost') ||
                        baseURL.includes('127.0.0.1');

    if (!isLocalhost) {
        console.warn('WARNING: Test mode only works on localhost URLs');
        console.warn('Tests against production will fail authentication bypass');
    }

    // Create test output directories if they don't exist
    const fs = require('fs');
    const path = require('path');

    const dirs = [
        'test-results',
        'test-results/artifacts',
        'test-results/html-report',
    ];

    dirs.forEach(dir => {
        const fullPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });

    console.log('=== Setup Complete ===\n');
};
