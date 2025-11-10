#!/usr/bin/env node

/**
 * Update Build Timestamp
 *
 * Updates the APP_VERSION timestamp in index.html with the current date/time
 * Runs automatically before deployments
 */

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');

// Read index.html
let content = fs.readFileSync(indexPath, 'utf8');

// Generate timestamp
const now = new Date();
const timestamp = now.toISOString().replace('T', ' ').substring(0, 19); // Format: YYYY-MM-DD HH:MM:SS

console.log(`Updating build timestamp to: ${timestamp}`);

// Update the timestamp in APP_VERSION
content = content.replace(
  /timestamp:\s*'[^']*'/,
  `timestamp: '${timestamp}'`
);

// Write back to file
fs.writeFileSync(indexPath, content, 'utf8');

console.log('✓ Build timestamp updated successfully');
