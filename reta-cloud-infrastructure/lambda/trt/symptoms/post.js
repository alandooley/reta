const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/trt/symptoms
 * Creates a new TRT symptom check-in for the authenticated user
 */
exports.handler = async (event) => {
  console.log('POST /v1/trt/symptoms called:', JSON.stringify(event, null, 2));

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
    const { id, timestamp, energyLevel, mood, libido, sleepQuality } = body;
    if (!timestamp || energyLevel === undefined || mood === undefined ||
        libido === undefined || sleepQuality === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: timestamp, energyLevel, mood, libido, sleepQuality',
        }),
      };
    }

    // Validate ranges (1-10 scale)
    if (energyLevel < 1 || energyLevel > 10 || mood < 1 || mood > 10 ||
        libido < 1 || libido > 10 || sleepQuality < 1 || sleepQuality > 10) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'All symptom ratings must be between 1 and 10',
        }),
      };
    }

    // Use provided ID or generate new one
    const symptomId = id || randomUUID();
    const now = new Date().toISOString();

    // Create symptom item
    const item = {
      PK: `USER#${userId}`,
      SK: `TRT_SYMPTOM#${symptomId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TIMESTAMP#${timestamp}`,
      timestamp,
      energyLevel: parseInt(energyLevel),
      mood: parseInt(mood),
      libido: parseInt(libido),
      sleepQuality: parseInt(sleepQuality),
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      entityType: 'TRT_SYMPTOM',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created TRT symptom ${symptomId} for user ${userId}`);

    // Return created symptom entry
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: symptomId,
          timestamp,
          energyLevel: parseInt(energyLevel),
          mood: parseInt(mood),
          libido: parseInt(libido),
          sleepQuality: parseInt(sleepQuality),
          notes: body.notes || '',
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating TRT symptom:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create symptom check-in',
        message: error.message,
      }),
    };
  }
};
