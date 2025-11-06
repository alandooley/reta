#!/usr/bin/env node
/**
 * Sync Version Script
 *
 * Automatically updates version numbers in:
 * 1. Frontend: index.html (APP_VERSION constant)
 * 2. Backend: reta-cloud-infrastructure/lambda/version/version.ts
 *
 * Source of truth: package.json version field
 *
 * Usage:
 *   node scripts/sync-version.js
 *   npm run sync-version
 */

const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const buildDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

console.log(`🔄 Syncing version to: ${version}`);

// 1. Update frontend (index.html)
const indexPath = path.join(__dirname, '../index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

const frontendVersionRegex = /const APP_VERSION = \{[\s\S]*?frontend: ['"][\d.]+['"],[\s\S]*?timestamp: ['"][\d-]+['"][\s\S]*?\};/;
const frontendReplacement = `const APP_VERSION = {
            frontend: '${version}',
            timestamp: '${buildDate}'
        };`;

if (frontendVersionRegex.test(indexHtml)) {
    indexHtml = indexHtml.replace(frontendVersionRegex, frontendReplacement);
    fs.writeFileSync(indexPath, indexHtml, 'utf8');
    console.log(`✅ Updated frontend version in index.html to ${version}`);
} else {
    console.warn('⚠️  Could not find APP_VERSION in index.html');
}

// 2. Update backend (version.ts)
const backendVersionPath = path.join(__dirname, '../reta-cloud-infrastructure/lambda/version/version.ts');
let backendVersion = fs.readFileSync(backendVersionPath, 'utf8');

const backendVersionRegex = /const BACKEND_VERSION = ['"][\d.]+['"];/;
const buildDateRegex = /const BUILD_DATE = ['"][\d-]+['"];/;

if (backendVersionRegex.test(backendVersion)) {
    backendVersion = backendVersion.replace(backendVersionRegex, `const BACKEND_VERSION = '${version}';`);
    backendVersion = backendVersion.replace(buildDateRegex, `const BUILD_DATE = '${buildDate}';`);
    fs.writeFileSync(backendVersionPath, backendVersion, 'utf8');
    console.log(`✅ Updated backend version in version.ts to ${version}`);
} else {
    console.warn('⚠️  Could not find BACKEND_VERSION in version.ts');
}

console.log(`\n🎉 Version sync complete!`);
console.log(`   Frontend: ${version}`);
console.log(`   Backend:  ${version}`);
console.log(`   Date:     ${buildDate}\n`);
