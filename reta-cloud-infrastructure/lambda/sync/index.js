const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/sync
 * Bulk import data from local device to cloud
 */
exports.handler = async (event) => {
  console.log('POST /v1/sync called:', JSON.stringify(event, null, 2));

  try {
    // Extract user ID from authorizer context
    const userId = event.requestContext?.authorizer?.lambda?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { injections = [], vials = [], weights = [] } = body;

    // Track results
    const results = {
      injections: { imported: 0, failed: 0 },
      vials: { imported: 0, failed: 0 },
      weights: { imported: 0, failed: 0 },
    };

    const now = new Date().toISOString();

    // Process vials first (needed for injection references)
    if (vials.length > 0) {
      const vialItems = vials.map(vial => {
        const vialId = vial.id || randomUUID();
        return {
          PutRequest: {
            Item: {
              PK: `USER#${userId}`,
              SK: `VIAL#${vialId}`,
              GSI1PK: `USER#${userId}`,
              GSI1SK: `VIAL#${vial.startDate}`,
              startDate: vial.startDate,
              initialVolumeMl: vial.initialVolumeMl,
              // Issue #6 fix: Use canonical concentrationMgMl, accept both field names for backwards compatibility
              concentrationMgMl: vial.concentrationMgMl ?? vial.concentrationMgPerMl,
              currentVolumeMl: vial.currentVolumeMl || vial.initialVolumeMl,
              usedVolumeMl: vial.usedVolumeMl || 0,
              status: vial.status || 'active',
              source: vial.source || '',
              notes: vial.notes || '',
              createdAt: vial.createdAt || now,
              updatedAt: now,
              entityType: 'VIAL',
            },
          },
        };
      });

      await batchWrite(vialItems, results.vials);
    }

    // Process injections
    if (injections.length > 0) {
      const injectionItems = injections.map(injection => {
        const injectionId = injection.id || randomUUID();
        return {
          PutRequest: {
            Item: {
              PK: `USER#${userId}`,
              SK: `INJECTION#${injectionId}`,
              GSI1PK: `USER#${userId}`,
              GSI1SK: `TIMESTAMP#${injection.timestamp}`,
              timestamp: injection.timestamp,
              doseMg: injection.doseMg,
              site: injection.site,
              notes: injection.notes || '',
              vialId: injection.vialId || null,
              createdAt: injection.createdAt || now,
              updatedAt: now,
              entityType: 'INJECTION',
              skipped: injection.skipped || false,
              ...(injection.plannedDoseMg && { plannedDoseMg: injection.plannedDoseMg }),
            },
          },
        };
      });

      await batchWrite(injectionItems, results.injections);
    }

    // Process weights
    if (weights.length > 0) {
      const weightItems = weights.map(weight => {
        const weightId = weight.id || randomUUID();
        return {
          PutRequest: {
            Item: {
              PK: `USER#${userId}`,
              SK: `WEIGHT#${weightId}`,
              GSI1PK: `USER#${userId}`,
              GSI1SK: `TIMESTAMP#${weight.timestamp}`,
              timestamp: weight.timestamp,
              weightKg: weight.weightKg,
              notes: weight.notes || '',
              createdAt: weight.createdAt || now,
              updatedAt: now,
              entityType: 'WEIGHT',
            },
          },
        };
      });

      await batchWrite(weightItems, results.weights);
    }

    console.log('Sync completed:', JSON.stringify(results));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        results,
        totalImported:
          results.injections.imported +
          results.vials.imported +
          results.weights.imported,
        totalFailed:
          results.injections.failed +
          results.vials.failed +
          results.weights.failed,
      }),
    };

  } catch (error) {
    console.error('Error syncing data:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to sync data',
        message: error.message,
      }),
    };
  }
};

/**
 * Helper function to batch write items to DynamoDB
 * DynamoDB BatchWrite supports max 25 items per request
 */
async function batchWrite(items, resultTracker) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    try {
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [process.env.TABLE_NAME]: chunk,
        },
      }));
      resultTracker.imported += chunk.length;
    } catch (error) {
      console.error('Batch write error:', error);
      resultTracker.failed += chunk.length;
    }
  }
}
