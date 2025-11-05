const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/injections
 * Creates a new injection record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('POST /v1/injections called:', JSON.stringify(event, null, 2));

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
    const { id, timestamp, doseMg, site } = body;
    if (!timestamp || !doseMg || !site) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: timestamp, doseMg, site',
        }),
      };
    }

    // Validate doseMg is a positive number
    if (typeof doseMg !== 'number' || doseMg <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'doseMg must be a positive number',
        }),
      };
    }

    // Validate site is valid injection site
    const validSites = ['abdomen', 'thigh', 'arm'];
    if (!validSites.includes(site)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `site must be one of: ${validSites.join(', ')}`,
        }),
      };
    }

    // Use provided ID or generate new one
    const injectionId = id || randomUUID();
    const now = new Date().toISOString();

    // Create injection item
    const item = {
      PK: `USER#${userId}`,
      SK: `INJECTION#${injectionId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TIMESTAMP#${timestamp}`,
      timestamp,
      doseMg,
      site,
      notes: body.notes || '',
      vialId: body.vialId || null,
      createdAt: now,
      updatedAt: now,
      entityType: 'INJECTION',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created injection ${injectionId} for user ${userId}`);

    // Return created injection
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: injectionId,
          timestamp,
          doseMg,
          site,
          notes: body.notes || '',
          vialId: body.vialId || null,
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating injection:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create injection',
        message: error.message,
      }),
    };
  }
};
