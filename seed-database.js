const https = require('https');
const { spawn } = require('child_process');

// Get the Firebase ID token from AWS CLI
async function getFirebaseToken() {
    return new Promise((resolve, reject) => {
        const proc = spawn('aws', [
            'secretsmanager', 'get-secret-value',
            '--secret-id', 'firebase-service-account',
            '--region', 'eu-west-1',
            '--profile', 'reta-admin',
            '--query', 'SecretString',
            '--output', 'text'
        ]);

        let output = '';
        proc.stdout.on('data', (data) => { output += data; });
        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Failed to get Firebase service account'));
            } else {
                resolve(JSON.parse(output));
            }
        });
    });
}

// Use Firebase Admin SDK to create a custom token, then exchange for ID token
async function createCustomToken(serviceAccount, userId) {
    const admin = require('firebase-admin');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    const customToken = await admin.auth().createCustomToken(userId);

    // Exchange custom token for ID token
    const firebaseConfig = require('./firebase-config.json');
    const apiKey = firebaseConfig.apiKey;

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            token: customToken,
            returnSecureToken: true
        });

        const options = {
            hostname: 'identitytoolkit.googleapis.com',
            path: `/v1/accounts:signInWithCustomToken?key=${apiKey}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                const result = JSON.parse(data);
                if (result.idToken) {
                    resolve(result.idToken);
                } else {
                    reject(new Error('Failed to get ID token: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Make API request
function apiRequest(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
        const postData = body ? JSON.stringify(body) : null;

        const options = {
            hostname: '5is9pmy9be.execute-api.eu-west-1.amazonaws.com',
            path: `/v1${path}`,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (postData) {
            options.headers['Content-Length'] = postData.length;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function main() {
    try {
        console.log('Please provide your Firebase user ID (uid):');
        console.log('You can find this by opening the browser console on the app and typing: firebase.auth().currentUser.uid');

        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Enter your Firebase UID: ', async (userId) => {
            readline.close();

            console.log('Getting Firebase service account...');
            const serviceAccount = await getFirebaseToken();

            console.log('Creating custom token...');
            const token = await createCustomToken(serviceAccount, userId);
            console.log('Got ID token!');

            // Data to import
            const vialData = {
                startDate: '2025-09-13',
                initialVolumeMl: 1,
                concentrationMgPerMl: 10,
                currentVolumeMl: 0,
                usedVolumeMl: 1,
                status: 'finished',
                source: '',
                notes: 'Reconstituted 10mg with 1mL BAC water'
            };

            console.log('\n1. Importing vial...');
            const vialResult = await apiRequest('POST', '/vials', token, vialData);
            const vialId = vialResult.body.data.id;
            console.log(`✓ Vial created: ${vialId}`);

            const injections = [
                { timestamp: '2025-08-06T09:00:00.000Z', doseMg: 0.25, site: 'abdomen', notes: 'Right abdomen. First micro-dose (2.5 units) to start titration.', vialId: null },
                { timestamp: '2025-08-12T09:00:00.000Z', doseMg: 0.5, site: 'abdomen', notes: 'Right abdomen. Second dose (5 units). No major side effects.', vialId: null },
                { timestamp: '2025-08-19T09:00:00.000Z', doseMg: 1, site: 'abdomen', notes: 'Right abdomen. First 1.0 mg (10 units). Mild nausea only.', vialId: null },
                { timestamp: '2025-08-30T10:12:00.000Z', doseMg: 2, site: 'abdomen', notes: 'Right abdomen. First 2.0 mg dose (20 units). Mild appetite suppression.', vialId: null },
                { timestamp: '2025-09-06T09:00:00.000Z', doseMg: 3, site: 'abdomen', notes: 'Right abdomen. 3.0 mg (30 units). Tolerated well, little nausea.', vialId: null },
                { timestamp: '2025-09-13T09:00:00.000Z', doseMg: 4, site: 'abdomen', notes: 'Right abdomen. New vial reconstituted (10 mg + 1 mL BAC). First 4.0 mg dose (40 units).', vialId: vialId },
                { timestamp: '2025-09-20T09:00:00.000Z', doseMg: 4, site: 'abdomen', notes: 'Right abdomen. Second 4.0 mg dose. Mild suppression noticed.', vialId: vialId },
                { timestamp: '2025-09-27T10:51:00.000Z', doseMg: 4.2, site: 'abdomen', notes: 'Right abdomen. Only 42 units left in vial. Finished it. Suppression moderate.', vialId: vialId }
            ];

            console.log('\n2. Importing 8 injections...');
            for (let i = 0; i < injections.length; i++) {
                await apiRequest('POST', '/injections', token, injections[i]);
                console.log(`✓ Injection ${i + 1}/8 imported`);
            }

            const weights = [
                { timestamp: '2025-08-06T09:00:00.000Z', weightKg: 95, notes: '' },
                { timestamp: '2025-08-19T09:00:00.000Z', weightKg: 96, notes: '' },
                { timestamp: '2025-08-30T10:12:00.000Z', weightKg: 93.6, notes: '' },
                { timestamp: '2025-09-06T09:00:00.000Z', weightKg: 93, notes: '' },
                { timestamp: '2025-09-20T09:00:00.000Z', weightKg: 90.9, notes: '' },
                { timestamp: '2025-09-27T10:51:00.000Z', weightKg: 89.7, notes: '' }
            ];

            console.log('\n3. Importing 6 weight entries...');
            for (let i = 0; i < weights.length; i++) {
                await apiRequest('POST', '/weights', token, weights[i]);
                console.log(`✓ Weight ${i + 1}/6 imported`);
            }

            console.log('\n✅ All data imported successfully!');
            console.log('\nSummary:');
            console.log('- 1 vial');
            console.log('- 8 injections');
            console.log('- 6 weight entries');
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();
