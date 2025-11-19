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
    const { id, timestamp, doseMg, site, skipped, plannedDoseMg } = body;
    if (!timestamp) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required field: timestamp',
        }),
      };
    }

    // Check if this is a skipped injection
    const isSkipped = skipped === true;

    if (isSkipped) {
      // Skipped injection validation
      if (doseMg !== 0 && typeof doseMg !== 'undefined') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Skipped injections must have doseMg = 0',
          }),
        };
      }
    } else {
      // Normal injection validation
      if (!doseMg || !site) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: doseMg, site',
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
      const validSites = [
        'left_thigh', 'right_thigh',
        'left_arm', 'right_arm',
        'abdomen_left', 'abdomen_right'
      ];
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
      doseMg: isSkipped ? 0 : doseMg,
      site: isSkipped ? null : site,
      notes: body.notes || '',
      vialId: isSkipped ? null : (body.vialId || null),
      createdAt: now,
      updatedAt: now,
      entityType: 'INJECTION',
      skipped: isSkipped,
    };

    // Add plannedDoseMg for skipped injections
    if (isSkipped && plannedDoseMg) {
      item.plannedDoseMg = plannedDoseMg;
    }

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created injection ${injectionId} for user ${userId}`);

    // Return created injection
    const responseData = {
      id: injectionId,
      timestamp,
      doseMg: isSkipped ? 0 : doseMg,
      site: isSkipped ? null : site,
      notes: body.notes || '',
      vialId: isSkipped ? null : (body.vialId || null),
      createdAt: now,
      updatedAt: now,
      skipped: isSkipped,
    };

    // Add plannedDoseMg for skipped injections
    if (isSkipped && plannedDoseMg) {
      responseData.plannedDoseMg = plannedDoseMg;
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: responseData,
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
