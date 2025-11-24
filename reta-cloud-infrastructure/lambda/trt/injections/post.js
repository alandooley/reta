const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/trt/injections
 * Creates a new TRT injection record for the authenticated user
 * Auto-calculates doseMg from volumeMl × concentrationMgMl
 * Updates vial remaining volume
 */
exports.handler = async (event) => {
  console.log('POST /v1/trt/injections called:', JSON.stringify(event, null, 2));

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
    const { id, timestamp, volumeMl, concentrationMgMl, injectionSite, vialId, skipped, plannedVolumeMl, plannedDoseMg } = body;

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
      if (volumeMl !== 0 && typeof volumeMl !== 'undefined') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Skipped injections must have volumeMl = 0',
          }),
        };
      }
    } else {
      // Normal injection validation
      if (!volumeMl || !concentrationMgMl || !injectionSite) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Missing required fields: volumeMl, concentrationMgMl, injectionSite',
          }),
        };
      }

      // Validate volumeMl is a positive number
      if (typeof volumeMl !== 'number' || volumeMl <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'volumeMl must be a positive number',
          }),
        };
      }

      // Validate concentrationMgMl is a positive number
      if (typeof concentrationMgMl !== 'number' || concentrationMgMl <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'concentrationMgMl must be a positive number',
          }),
        };
      }

      // Validate injection site
      const validSites = ['left_front_thigh', 'right_front_thigh'];
      if (!validSites.includes(injectionSite)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: `injectionSite must be one of: ${validSites.join(', ')}`,
          }),
        };
      }

      // If vialId provided, verify vial exists and is active
      if (vialId) {
        const vialResult = await docClient.send(new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: {
            PK: `USER#${userId}`,
            SK: `TRT_VIAL#${vialId}`,
          },
        }));

        if (!vialResult.Item) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: 'Vial not found',
            }),
          };
        }

        if (vialResult.Item.status !== 'active') {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: 'Cannot use vial with status: ' + vialResult.Item.status,
            }),
          };
        }

        // Check if vial has enough remaining volume
        if (vialResult.Item.remainingMl < volumeMl) {
          return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              error: `Vial only has ${vialResult.Item.remainingMl}ml remaining, cannot draw ${volumeMl}ml`,
            }),
          };
        }
      }
    }

    // Calculate dose (volumeMl × concentrationMgMl)
    const doseMg = isSkipped ? 0 : volumeMl * concentrationMgMl;

    // Use provided ID or generate new one
    const injectionId = id || randomUUID();
    const now = new Date().toISOString();

    // Create injection item
    const item = {
      PK: `USER#${userId}`,
      SK: `TRT_INJECTION#${injectionId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TIMESTAMP#${timestamp}`,
      timestamp,
      volumeMl: isSkipped ? 0 : volumeMl,
      concentrationMgMl: isSkipped ? 0 : concentrationMgMl,
      doseMg,
      injectionSite: isSkipped ? null : injectionSite,
      timeOfDay: body.timeOfDay || null,
      techniqueNotes: body.techniqueNotes || '',
      notes: body.notes || '',
      vialId: isSkipped ? null : (vialId || null),
      createdAt: now,
      updatedAt: now,
      entityType: 'TRT_INJECTION',
      skipped: isSkipped,
    };

    // Add planned fields for skipped injections
    if (isSkipped) {
      if (plannedVolumeMl) {
        item.plannedVolumeMl = plannedVolumeMl;
      }
      if (plannedDoseMg) {
        item.plannedDoseMg = plannedDoseMg;
      }
    }

    // Save injection to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    // Update vial remaining volume if not skipped and vialId provided
    if (!isSkipped && vialId) {
      await docClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRT_VIAL#${vialId}`,
        },
        UpdateExpression: 'SET remainingMl = remainingMl - :volume, updatedAt = :now',
        ExpressionAttributeValues: {
          ':volume': volumeMl,
          ':now': now,
        },
      }));

      console.log(`Updated vial ${vialId}: reduced by ${volumeMl}ml`);
    }

    console.log(`Created TRT injection ${injectionId} for user ${userId}`);

    // Return created injection
    const responseData = {
      id: injectionId,
      timestamp,
      volumeMl: isSkipped ? 0 : volumeMl,
      concentrationMgMl: isSkipped ? 0 : concentrationMgMl,
      doseMg,
      injectionSite: isSkipped ? null : injectionSite,
      timeOfDay: body.timeOfDay || null,
      techniqueNotes: body.techniqueNotes || '',
      notes: body.notes || '',
      vialId: isSkipped ? null : (vialId || null),
      createdAt: now,
      updatedAt: now,
      skipped: isSkipped,
    };

    // Add planned fields for skipped injections
    if (isSkipped) {
      if (plannedVolumeMl) {
        responseData.plannedVolumeMl = plannedVolumeMl;
      }
      if (plannedDoseMg) {
        responseData.plannedDoseMg = plannedDoseMg;
      }
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
    console.error('Error creating TRT injection:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create TRT injection',
        message: error.message,
      }),
    };
  }
};
