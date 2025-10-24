const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/weights
 * Creates a new weight entry for the authenticated user
 */
exports.handler = async (event) => {
  console.log('POST /v1/weights called:', JSON.stringify(event, null, 2));

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
    const { timestamp, weightKg } = body;
    if (!timestamp || !weightKg) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: timestamp, weightKg',
        }),
      };
    }

    // Validate weightKg is a positive number
    if (typeof weightKg !== 'number' || weightKg <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'weightKg must be a positive number',
        }),
      };
    }

    // Generate weight ID
    const weightId = randomUUID();
    const now = new Date().toISOString();

    // Create weight item
    const item = {
      PK: `USER#${userId}`,
      SK: `WEIGHT#${weightId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TIMESTAMP#${timestamp}`,
      timestamp,
      weightKg,
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      entityType: 'WEIGHT',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created weight entry ${weightId} for user ${userId}`);

    // Return created weight entry
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: weightId,
          timestamp,
          weightKg,
          notes: body.notes || '',
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating weight entry:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create weight entry',
        message: error.message,
      }),
    };
  }
};
