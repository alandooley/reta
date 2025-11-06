const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/vials
 * Creates a new vial record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('POST /v1/vials called:', JSON.stringify(event, null, 2));

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

    // Validate required fields
    const { id, startDate, initialVolumeMl, concentrationMgPerMl } = body;
    if (!startDate || initialVolumeMl === undefined || concentrationMgPerMl === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: startDate, initialVolumeMl, concentrationMgPerMl',
        }),
      };
    }

    // Validate numeric fields are non-negative (allow 0 for dry stock)
    if (typeof initialVolumeMl !== 'number' || initialVolumeMl < 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'initialVolumeMl must be a non-negative number',
        }),
      };
    }

    if (typeof concentrationMgPerMl !== 'number' || concentrationMgPerMl < 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'concentrationMgPerMl must be a non-negative number',
        }),
      };
    }

    // Use provided ID or generate new one
    const vialId = id || randomUUID();
    const now = new Date().toISOString();

    // Create vial item
    const item = {
      PK: `USER#${userId}`,
      SK: `VIAL#${vialId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `VIAL#${startDate}`,
      startDate,
      initialVolumeMl,
      concentrationMgPerMl,
      currentVolumeMl: body.currentVolumeMl || initialVolumeMl,
      usedVolumeMl: body.usedVolumeMl || 0,
      status: body.status || 'active',
      source: body.source || '',
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      entityType: 'VIAL',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created vial ${vialId} for user ${userId}`);

    // Return created vial
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: vialId,
          startDate,
          initialVolumeMl,
          concentrationMgPerMl,
          currentVolumeMl: item.currentVolumeMl,
          usedVolumeMl: item.usedVolumeMl,
          status: item.status,
          source: item.source,
          notes: item.notes,
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create vial',
        message: error.message,
      }),
    };
  }
};
