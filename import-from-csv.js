/**
 * Import data from CSV to cloud database
 * Run with: node import-from-csv.js
 */

const fs = require('fs');
const https = require('https');

const API_BASE = 'https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1';

// Your Firebase ID token - GET THIS FROM BROWSER CONSOLE
// Run: firebase.auth().currentUser.getIdToken().then(t => console.log(t))
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
    console.error('Usage: node import-from-csv.js <FIREBASE_TOKEN>');
    console.error('\nTo get your token, open the app in browser and run this in console:');
    console.error('firebase.auth().currentUser.getIdToken().then(t => console.log(t))');
    process.exit(1);
}

// Parse CSV
const csv = fs.readFileSync('./injection_log_2025-10-24.csv', 'utf8');
const lines = csv.split('\n').slice(1).filter(line => line.trim());

const injections = [];
const weights = [];

lines.forEach(line => {
    // Parse CSV line (handle quoted fields)
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
    if (!matches || matches.length < 6) return;

    const [date, time, doseMg, site, weightKg, notes] = matches.map(m => m.replace(/^"|"$/g, ''));

    // Parse date (DD/MM/YYYY)
    const [day, month, year] = date.split('/');
    const timestamp = new Date(`${year}-${month}-${day}T${time}Z`).toISOString();

    // Create injection
    injections.push({
        timestamp,
        doseMg: parseFloat(doseMg),
        site: site.replace(/_/g, ' '),
        notes: notes || '',
        vialId: notes.includes('New vial') ? 'vial-1' : null
    });

    // Create weight entry if weight exists and is different from previous
    const weight = parseFloat(weightKg);
    if (weight && (weights.length === 0 || weights[weights.length - 1].weightKg !== weight)) {
        weights.push({
            timestamp,
            weightKg: weight,
            notes: ''
        });
    }
});

console.log(`Parsed ${injections.length} injections and ${weights.length} weight entries`);

// Helper function to make API request
function apiRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_BASE + path);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Import data
async function importData() {
    console.log('\nImporting injections...');
    for (const injection of injections) {
        try {
            await apiRequest('POST', '/injections', injection);
            const date = new Date(injection.timestamp);
            console.log(`✓ ${date.toLocaleDateString()} - ${injection.doseMg}mg`);
        } catch (error) {
            console.error(`✗ Failed:`, error.message);
        }
    }

    console.log('\nImporting weights...');
    for (const weight of weights) {
        try {
            await apiRequest('POST', '/weights', weight);
            const date = new Date(weight.timestamp);
            console.log(`✓ ${date.toLocaleDateString()} - ${weight.weightKg}kg`);
        } catch (error) {
            console.error(`✗ Failed:`, error.message);
        }
    }

    // Create vial
    console.log('\nCreating vial...');
    try {
        const vial = {
            id: 'vial-1',
            startDate: '2025-09-13',
            initialVolumeMl: 1,
            concentrationMgPerMl: 10,
            currentVolumeMl: 0,
            usedVolumeMl: 1,
            status: 'finished',
            source: '',
            notes: 'Reconstituted 10mg with 1mL BAC water'
        };
        await apiRequest('POST', '/vials', vial);
        console.log('✓ Vial created');
    } catch (error) {
        console.error('✗ Vial creation failed:', error.message);
    }

    console.log('\n✅ Import complete! Refresh your app to see the data.');
}

importData().catch(console.error);
