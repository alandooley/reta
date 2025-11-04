/**
 * Migration Script for Retatrutide Tracker
 * Migrates data from CSV export to cloud database
 */

const fs = require('fs');
const path = require('path');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDkdbPPZ2pySDOWBhAsSWzkfyYWvR0jlO8",
  authDomain: "reta-tracker.firebaseapp.com",
  projectId: "reta-tracker",
};

// API endpoint
const API_ENDPOINT = 'https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com';

/**
 * Parse CSV file and convert to injections and weights
 */
function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  // Skip header
  const dataLines = lines.slice(1);

  const injections = [];
  const weights = [];
  const vials = [];
  let currentVialId = null;

  dataLines.forEach((line, index) => {
    // Parse CSV line (handle quoted fields)
    const fields = parseCSVLine(line);

    if (fields.length < 6) {
      console.warn(`Skipping line ${index + 2}: insufficient fields`);
      return;
    }

    const [dateStr, timeStr, doseMgStr, site, weightKgStr, notes] = fields;

    // Parse date in DD/MM/YYYY format
    const [day, month, year] = dateStr.split('/');
    const timestamp = new Date(`${year}-${month}-${day}T${timeStr}`).toISOString();

    // Check if notes mention a new vial
    const vialMatch = notes.match(/(?:New vial|vial).*?(\d+)\s*mg/i);
    if (vialMatch) {
      const totalMg = parseFloat(vialMatch[1]);
      const volumeMatch = notes.match(/(\d+(?:\.\d+)?)\s*mL/i);
      const volumeMl = volumeMatch ? parseFloat(volumeMatch[1]) : 1.0; // Default to 1mL

      currentVialId = `vial-${vials.length + 1}`;
      vials.push({
        id: currentVialId,
        startDate: timestamp.split('T')[0], // Just the date
        initialVolumeMl: volumeMl,
        concentrationMgPerMl: totalMg / volumeMl,
        currentVolumeMl: volumeMl,
        usedVolumeMl: 0,
        status: 'active',
        source: '',
        notes: `Extracted from injection log: ${notes}`,
      });
    }

    // Create injection
    injections.push({
      timestamp,
      doseMg: parseFloat(doseMgStr),
      site: site.toLowerCase().replace('_', ' '), // Convert right_abdomen to "right abdomen"
      notes: notes || '',
      vialId: currentVialId, // Link to current vial
    });

    // Create weight entry (only if weight is different or first entry)
    const weightKg = parseFloat(weightKgStr);
    if (weightKg && (weights.length === 0 || weights[weights.length - 1].weightKg !== weightKg)) {
      weights.push({
        timestamp,
        weightKg,
        notes: '', // Weight notes can be added if needed
      });
    }
  });

  return { injections, weights, vials };
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

/**
 * Authenticate with Firebase and get ID token
 */
async function authenticateWithFirebase() {
  console.log('\n=== Firebase Authentication ===');
  console.log('Please sign in with Google in the browser window that will open...');

  // For now, we'll use a simple approach - the user needs to manually get their token
  console.log('\nTo get your Firebase ID token:');
  console.log('1. Open your browser console on the app');
  console.log('2. Run: firebase.auth().currentUser.getIdToken().then(console.log)');
  console.log('3. Copy the token and paste it below\n');

  // In a real implementation, we'd use Firebase SDK here
  // For now, return a placeholder that the user will need to replace
  throw new Error('Please implement Firebase authentication or manually provide ID token');
}

/**
 * Upload data to cloud using sync API
 */
async function uploadData(idToken, injections, weights) {
  const payload = {
    injections,
    weights,
    vials: [], // No vials in CSV, but we could infer them from notes
  };

  console.log('\n=== Uploading Data ===');
  console.log(`Injections: ${injections.length}`);
  console.log(`Weights: ${weights.length}`);

  const response = await fetch(`${API_ENDPOINT}/v1/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Upload failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log('\n=== Upload Results ===');
  console.log(JSON.stringify(result, null, 2));

  return result;
}

/**
 * Main migration function
 */
async function migrate(csvPath, idToken) {
  try {
    console.log('=== Retatrutide Data Migration ===\n');
    console.log(`Reading CSV: ${csvPath}`);

    // Parse CSV
    const { injections, weights, vials } = parseCSV(csvPath);

    console.log(`\nParsed ${injections.length} injections, ${weights.length} weights, and ${vials.length} vials`);

    // Preview data
    console.log('\n=== Preview ===');
    console.log('First injection:', JSON.stringify(injections[0], null, 2));
    if (weights.length > 0) {
      console.log('First weight:', JSON.stringify(weights[0], null, 2));
    }
    if (vials.length > 0) {
      console.log('First vial:', JSON.stringify(vials[0], null, 2));
    }

    // Upload to cloud
    if (idToken) {
      await uploadData(idToken, injections, weights);
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Dry run complete. To upload, provide Firebase ID token.');

      // Save to file for manual upload
      const outputPath = path.join(path.dirname(csvPath), 'migration-data.json');
      fs.writeFileSync(outputPath, JSON.stringify({ injections, weights, vials }, null, 2));
      console.log(`\nData saved to: ${outputPath}`);
      console.log('You can upload this file manually using the sync API.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
const csvPath = process.argv[2] || path.join(__dirname, 'injection_log_2025-10-24.csv');
const idToken = process.argv[3]; // Optional: Firebase ID token

migrate(csvPath, idToken);
