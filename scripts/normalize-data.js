/**
 * One-time data normalization script
 *
 * Purpose:
 * 1. Remove duplicate injections (one per day only)
 * 2. Associate weights with injections
 * 3. Fix injection site inconsistencies
 *
 * Run with: node scripts/normalize-data.js [--dry-run]
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, DeleteCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { fromIni } = require('@aws-sdk/credential-provider-ini');

const TABLE_NAME = 'retatrutide-tracker-prod';
const REGION = 'eu-west-1';
const PROFILE = 'reta-admin';

// Valid injection sites
const VALID_SITES = [
  'left_thigh',
  'right_thigh',
  'left_abdomen',
  'right_abdomen',
  'left_arm',
  'right_arm'
];

// Site mapping for inconsistencies
const SITE_MAPPINGS = {
  'thigh_left': 'left_thigh',
  'thigh_right': 'right_thigh',
  'abdomen_left': 'left_abdomen',
  'abdomen_right': 'right_abdomen',
  'arm_left': 'left_arm',
  'arm_right': 'right_arm',
  'left thigh': 'left_thigh',
  'right thigh': 'right_thigh',
  'left abdomen': 'left_abdomen',
  'right abdomen': 'right_abdomen',
  'left arm': 'left_arm',
  'right arm': 'right_arm'
};

const isDryRun = process.argv.includes('--dry-run');

// Initialize AWS SDK
const client = new DynamoDBClient({
  region: REGION,
  credentials: fromIni({ profile: PROFILE })
});
const docClient = DynamoDBDocumentClient.from(client);

async function scanAllData() {
  console.log('📊 Scanning DynamoDB table...');

  const params = {
    TableName: TABLE_NAME
  };

  const items = [];
  let lastEvaluatedKey = null;

  do {
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new ScanCommand(params));
    items.push(...response.Items);
    lastEvaluatedKey = response.LastEvaluatedKey;

    console.log(`  Scanned ${items.length} items so far...`);
  } while (lastEvaluatedKey);

  console.log(`✓ Total items scanned: ${items.length}\n`);
  return items;
}

function parseItems(items) {
  const injections = [];
  const weights = [];
  const vials = [];

  for (const item of items) {
    if (item.SK.startsWith('INJECTION#')) {
      injections.push({
        ...item,
        id: item.SK.replace('INJECTION#', ''),
        userId: item.PK.replace('USER#', '')
      });
    } else if (item.SK.startsWith('WEIGHT#')) {
      weights.push({
        ...item,
        id: item.SK.replace('WEIGHT#', ''),
        userId: item.PK.replace('USER#', '')
      });
    } else if (item.SK.startsWith('VIAL#')) {
      vials.push({
        ...item,
        id: item.SK.replace('VIAL#', ''),
        userId: item.PK.replace('USER#', '')
      });
    }
  }

  console.log(`📋 Parsed items:`);
  console.log(`  Injections: ${injections.length}`);
  console.log(`  Weights: ${weights.length}`);
  console.log(`  Vials: ${vials.length}\n`);

  return { injections, weights, vials };
}

function findDuplicates(injections) {
  console.log('🔍 Finding duplicate injections (same day)...');

  // Group by userId and date
  const groups = new Map();

  for (const inj of injections) {
    const date = inj.timestamp.split('T')[0]; // YYYY-MM-DD
    const key = `${inj.userId}|${date}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(inj);
  }

  // Find groups with duplicates
  const duplicates = [];
  for (const [key, group] of groups) {
    if (group.length > 1) {
      // Sort by completeness score (highest first)
      group.sort((a, b) => {
        const scoreA = (a.notes ? 1 : 0) + (a.weightKg ? 1 : 0) + (a.vialId ? 1 : 0);
        const scoreB = (b.notes ? 1 : 0) + (b.weightKg ? 1 : 0) + (b.vialId ? 1 : 0);

        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Higher score first
        }

        // If tied, keep earliest timestamp
        return new Date(a.timestamp) - new Date(b.timestamp);
      });

      const [keep, ...remove] = group;
      duplicates.push({
        date: key.split('|')[1],
        keep,
        remove
      });
    }
  }

  console.log(`✓ Found ${duplicates.length} sets of duplicates\n`);
  return duplicates;
}

function fixInjectionSite(site) {
  if (!site) return null;

  const normalized = site.toLowerCase().trim();

  // Check if already valid
  if (VALID_SITES.includes(normalized)) {
    return normalized;
  }

  // Apply mappings
  if (SITE_MAPPINGS[normalized]) {
    return SITE_MAPPINGS[normalized];
  }

  // Try to find partial match
  for (const validSite of VALID_SITES) {
    if (normalized.includes(validSite.replace('_', ' ')) ||
        normalized.includes(validSite.replace('_', ''))) {
      return validSite;
    }
  }

  return null; // Invalid site
}

function checkSiteConsistency(injections) {
  console.log('🎯 Checking injection site consistency...');

  const fixes = [];

  for (const inj of injections) {
    const originalSite = inj.site;
    const fixedSite = fixInjectionSite(originalSite);

    if (fixedSite !== originalSite) {
      console.log(`  ${inj.id}: "${originalSite}" → "${fixedSite || 'INVALID'}"`);
      fixes.push({
        injection: inj,
        originalSite,
        fixedSite
      });
    }
  }

  console.log(`✓ Found ${fixes.length} injection sites to fix\n`);
  return fixes;
}

function findClosestWeight(injectionTimestamp, weights) {
  if (weights.length === 0) return null;

  const injTime = new Date(injectionTimestamp).getTime();
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000; // 1 week window

  let closest = null;
  let minDiff = Infinity;

  for (const weight of weights) {
    const wtTime = new Date(weight.timestamp).getTime();
    const diff = Math.abs(injTime - wtTime);

    if (diff < minDiff && diff <= WEEK_MS) {
      minDiff = diff;
      closest = weight;
    }
  }

  return closest;
}

function associateWeights(injections, weights) {
  console.log('⚖️  Associating weights with injections...');

  // Group by userId
  const userWeights = new Map();
  for (const weight of weights) {
    if (!userWeights.has(weight.userId)) {
      userWeights.set(weight.userId, []);
    }
    userWeights.get(weight.userId).push(weight);
  }

  const associations = [];

  for (const inj of injections) {
    // Skip if already has weight
    if (inj.weightKg) continue;

    const userWeightList = userWeights.get(inj.userId) || [];
    const closestWeight = findClosestWeight(inj.timestamp, userWeightList);

    if (closestWeight) {
      const diffMs = Math.abs(new Date(inj.timestamp) - new Date(closestWeight.timestamp));
      const diffDays = (diffMs / (1000 * 60 * 60 * 24)).toFixed(1);

      associations.push({
        injection: inj,
        weight: closestWeight.weightKg,
        weightTimestamp: closestWeight.timestamp,
        diffDays
      });
    }
  }

  console.log(`✓ Found ${associations.length} weights to associate\n`);
  return associations;
}

async function deleteDuplicates(duplicates) {
  console.log(`🗑️  Deleting ${duplicates.flatMap(d => d.remove).length} duplicate injections...`);

  for (const dup of duplicates) {
    console.log(`\n  Date: ${dup.date}`);
    console.log(`    Keeping: ${dup.keep.id} (score: ${(dup.keep.notes ? 1 : 0) + (dup.keep.weightKg ? 1 : 0) + (dup.keep.vialId ? 1 : 0)})`);

    for (const inj of dup.remove) {
      console.log(`    Deleting: ${inj.id} (${inj.timestamp})`);

      if (!isDryRun) {
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            PK: inj.PK,
            SK: inj.SK
          }
        }));
      }
    }
  }

  console.log(`\n✓ Deleted ${duplicates.flatMap(d => d.remove).length} duplicates\n`);
}

async function updateInjectionSites(siteFixes) {
  console.log(`🔧 Fixing ${siteFixes.length} injection sites...`);

  for (const fix of siteFixes) {
    console.log(`  ${fix.injection.id}: "${fix.originalSite}" → "${fix.fixedSite}"`);

    if (!isDryRun) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: fix.injection.PK,
          SK: fix.injection.SK
        },
        UpdateExpression: 'SET site = :site, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':site': fix.fixedSite,
          ':updatedAt': new Date().toISOString()
        }
      }));
    }
  }

  console.log(`✓ Fixed ${siteFixes.length} injection sites\n`);
}

async function updateWeightAssociations(associations) {
  console.log(`💉 Associating ${associations.length} weights with injections...`);

  for (const assoc of associations) {
    console.log(`  ${assoc.injection.id}: Adding ${assoc.weight}kg (${assoc.diffDays} days diff)`);

    if (!isDryRun) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: assoc.injection.PK,
          SK: assoc.injection.SK
        },
        UpdateExpression: 'SET weightKg = :weight, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':weight': assoc.weight,
          ':updatedAt': new Date().toISOString()
        }
      }));
    }
  }

  console.log(`✓ Associated ${associations.length} weights\n`);
}

async function main() {
  console.log('\n========================================');
  console.log('  DATA NORMALIZATION SCRIPT');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  console.log('========================================\n');

  if (isDryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('⚠️  EXECUTE MODE - Changes will be written to DynamoDB\n');
  }

  try {
    // 1. Scan all data
    const allItems = await scanAllData();
    const { injections, weights } = parseItems(allItems);

    // 2. Find duplicates
    const duplicates = findDuplicates(injections);

    // 3. Check site consistency
    const siteFixes = checkSiteConsistency(injections);

    // 4. Find weight associations
    const weightAssociations = associateWeights(injections, weights);

    // 5. Display summary
    console.log('========================================');
    console.log('  SUMMARY');
    console.log('========================================');
    console.log(`Total injections: ${injections.length}`);
    console.log(`Duplicate sets found: ${duplicates.length}`);
    console.log(`Duplicates to delete: ${duplicates.flatMap(d => d.remove).length}`);
    console.log(`Injection sites to fix: ${siteFixes.length}`);
    console.log(`Weights to associate: ${weightAssociations.length}`);
    console.log('========================================\n');

    if (isDryRun) {
      console.log('✓ Dry run complete. Review the changes above.');
      console.log('  To execute, run: node scripts/normalize-data.js\n');
      return;
    }

    // 6. Execute changes
    if (duplicates.length > 0) {
      await deleteDuplicates(duplicates);
    }

    if (siteFixes.length > 0) {
      await updateInjectionSites(siteFixes);
    }

    if (weightAssociations.length > 0) {
      await updateWeightAssociations(weightAssociations);
    }

    console.log('========================================');
    console.log('  ✓ NORMALIZATION COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
