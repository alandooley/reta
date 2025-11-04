// Direct DynamoDB seeding script - bypasses API
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');
const { fromIni } = require('@aws-sdk/credential-providers');

async function main() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('To find your Firebase UID:');
    console.log('1. Go to https://d13m7vzwjqe4pp.cloudfront.net/');
    console.log('2. Open browser console (F12)');
    console.log('3. Run: firebase.auth().currentUser.uid');
    console.log('4. Copy the UID and paste it here\n');

    readline.question('Enter your Firebase UID: ', async (userId) => {
        readline.close();

        try {
            const dynamoClient = new DynamoDBClient({
                region: 'eu-west-1',
                credentials: fromIni({ profile: 'reta-admin' })
            });
            const docClient = DynamoDBDocumentClient.from(dynamoClient);

            const tableName = 'retatrutide-tracker-prod';

            // Create vial
            const vialId = randomUUID();
            const now = new Date().toISOString();

            console.log('\n1. Creating vial...');
            await docClient.send(new PutCommand({
                TableName: tableName,
                Item: {
                    PK: `USER#${userId}`,
                    SK: `VIAL#${vialId}`,
                    GSI1PK: `USER#${userId}`,
                    GSI1SK: 'VIAL#2025-09-13',
                    startDate: '2025-09-13',
                    initialVolumeMl: 1,
                    concentrationMgPerMl: 10,
                    currentVolumeMl: 0,
                    usedVolumeMl: 1,
                    status: 'finished',
                    source: '',
                    notes: 'Reconstituted 10mg with 1mL BAC water',
                    createdAt: now,
                    updatedAt: now,
                    entityType: 'VIAL'
                }
            }));
            console.log(`✓ Vial created: ${vialId}`);

            // Create injections
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

            console.log('\n2. Creating 8 injections...');
            for (let i = 0; i < injections.length; i++) {
                const inj = injections[i];
                const injId = randomUUID();

                await docClient.send(new PutCommand({
                    TableName: tableName,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `INJECTION#${injId}`,
                        GSI1PK: `USER#${userId}`,
                        GSI1SK: `TIMESTAMP#${inj.timestamp}`,
                        timestamp: inj.timestamp,
                        doseMg: inj.doseMg,
                        site: inj.site,
                        notes: inj.notes,
                        vialId: inj.vialId,
                        createdAt: now,
                        updatedAt: now,
                        entityType: 'INJECTION'
                    }
                }));
                console.log(`✓ Injection ${i + 1}/8 created`);
            }

            // Create weights
            const weights = [
                { timestamp: '2025-08-06T09:00:00.000Z', weightKg: 95, notes: '' },
                { timestamp: '2025-08-19T09:00:00.000Z', weightKg: 96, notes: '' },
                { timestamp: '2025-08-30T10:12:00.000Z', weightKg: 93.6, notes: '' },
                { timestamp: '2025-09-06T09:00:00.000Z', weightKg: 93, notes: '' },
                { timestamp: '2025-09-20T09:00:00.000Z', weightKg: 90.9, notes: '' },
                { timestamp: '2025-09-27T10:51:00.000Z', weightKg: 89.7, notes: '' }
            ];

            console.log('\n3. Creating 6 weight entries...');
            for (let i = 0; i < weights.length; i++) {
                const wt = weights[i];
                const wtId = randomUUID();

                await docClient.send(new PutCommand({
                    TableName: tableName,
                    Item: {
                        PK: `USER#${userId}`,
                        SK: `WEIGHT#${wtId}`,
                        GSI1PK: `USER#${userId}`,
                        GSI1SK: `TIMESTAMP#${wt.timestamp}`,
                        timestamp: wt.timestamp,
                        weightKg: wt.weightKg,
                        notes: wt.notes,
                        createdAt: now,
                        updatedAt: now,
                        entityType: 'WEIGHT'
                    }
                }));
                console.log(`✓ Weight ${i + 1}/6 created`);
            }

            console.log('\n✅ All data seeded successfully!');
            console.log('\nSummary:');
            console.log('- 1 vial');
            console.log('- 8 injections');
            console.log('- 6 weight entries');
            console.log('\nRefresh your app to see the data!');

        } catch (error) {
            console.error('❌ Error:', error.message);
            console.error(error);
            process.exit(1);
        }
    });
}

main();
