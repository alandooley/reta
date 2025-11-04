/**
 * Browser Console Import Script
 * Copy and paste this entire script into your browser console (F12)
 * Make sure you're logged into the app first!
 */

(async function importCSVData() {
    console.log('🚀 Starting data import...');

    // Get auth token
    const token = await firebase.auth().currentUser.getIdToken();
    console.log('✓ Got authentication token');

    const API_BASE = 'https://5is9pmy9be.execute-api.eu-west-1.amazonaws.com/v1';

    // CSV data parsed
    const injections = [
        { timestamp: '2025-08-06T09:00:00.000Z', doseMg: 0.25, site: 'right abdomen', notes: 'First micro-dose (2.5 units) to start titration.', vialId: null },
        { timestamp: '2025-08-12T09:00:00.000Z', doseMg: 0.5, site: 'right abdomen', notes: 'Second dose (5 units). No major side effects.', vialId: null },
        { timestamp: '2025-08-19T09:00:00.000Z', doseMg: 1, site: 'right abdomen', notes: 'First 1.0 mg (10 units). Mild nausea only.', vialId: null },
        { timestamp: '2025-08-30T10:12:00.000Z', doseMg: 2, site: 'right abdomen', notes: 'First 2.0 mg dose (20 units). Mild appetite suppression.', vialId: null },
        { timestamp: '2025-09-06T09:00:00.000Z', doseMg: 3, site: 'right abdomen', notes: '3.0 mg (30 units). Tolerated well, little nausea.', vialId: null },
        { timestamp: '2025-09-13T09:00:00.000Z', doseMg: 4, site: 'right abdomen', notes: 'New vial reconstituted (10 mg + 1 mL BAC). First 4.0 mg dose (40 units).', vialId: 'vial-1' },
        { timestamp: '2025-09-20T09:00:00.000Z', doseMg: 4, site: 'right abdomen', notes: 'Second 4.0 mg dose. Mild suppression noticed.', vialId: 'vial-1' },
        { timestamp: '2025-09-27T10:51:00.000Z', doseMg: 4.2, site: 'right abdomen', notes: 'Only 42 units left in vial. Finished it. Suppression moderate.', vialId: 'vial-1' }
    ];

    const weights = [
        { timestamp: '2025-08-06T09:00:00.000Z', weightKg: 95, notes: '' },
        { timestamp: '2025-08-19T09:00:00.000Z', weightKg: 96, notes: '' },
        { timestamp: '2025-08-30T10:12:00.000Z', weightKg: 93.6, notes: '' },
        { timestamp: '2025-09-06T09:00:00.000Z', weightKg: 93, notes: '' },
        { timestamp: '2025-09-20T09:00:00.000Z', weightKg: 90.9, notes: '' },
        { timestamp: '2025-09-27T10:51:00.000Z', weightKg: 89.7, notes: '' }
    ];

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

    console.log(`📊 Found ${injections.length} injections, ${weights.length} weights, 1 vial`);

    // Import injections
    console.log('\n💉 Importing injections...');
    for (const inj of injections) {
        try {
            const res = await fetch(`${API_BASE}/injections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(inj)
            });
            const result = await res.json();
            const date = new Date(inj.timestamp).toLocaleDateString();
            console.log(`  ✓ ${date} - ${inj.doseMg}mg`);
        } catch (error) {
            console.error(`  ✗ Failed:`, error);
        }
    }

    // Import weights
    console.log('\n⚖️  Importing weights...');
    for (const wt of weights) {
        try {
            const res = await fetch(`${API_BASE}/weights`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(wt)
            });
            const result = await res.json();
            const date = new Date(wt.timestamp).toLocaleDateString();
            console.log(`  ✓ ${date} - ${wt.weightKg}kg`);
        } catch (error) {
            console.error(`  ✗ Failed:`, error);
        }
    }

    // Import vial
    console.log('\n🧪 Creating vial...');
    try {
        const res = await fetch(`${API_BASE}/vials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vial)
        });
        const result = await res.json();
        console.log('  ✓ Vial created');
    } catch (error) {
        console.error('  ✗ Vial creation failed:', error);
    }

    console.log('\n✅ Import complete! Refreshing page...');
    setTimeout(() => location.reload(), 2000);
})();
