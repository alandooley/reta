const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/trt/vials
 * Creates a new TRT vial record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('POST /v1/trt/vials called:', JSON.stringify(event, null, 2));

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
    const { id, concentrationMgMl, volumeMl, expiryDate, status } = body;

    if (!concentrationMgMl || !volumeMl || !expiryDate) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: concentrationMgMl, volumeMl, expiryDate',
        }),
      };
    }

    // Validate concentrationMgMl is positive
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

    // Validate volumeMl is positive
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

    // Validate status
    const validStatuses = ['active', 'dry_stock', 'empty', 'expired'];
    const vialStatus = status || 'dry_stock';
    if (!validStatuses.includes(vialStatus)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `status must be one of: ${validStatuses.join(', ')}`,
        }),
      };
    }

    // Use provided ID or generate new one
    const vialId = id || randomUUID();
    const now = new Date().toISOString();

    // Determine remaining volume
    // If status is active and no remainingMl provided, assume full vial
    // If status is dry_stock, remainingMl should equal volumeMl
    let remainingMl = body.remainingMl;
    if (remainingMl === undefined) {
      remainingMl = (vialStatus === 'active' || vialStatus === 'dry_stock') ? volumeMl : 0;
    }

    // Create vial item
    const item = {
      PK: `USER#${userId}`,
      SK: `TRT_VIAL#${vialId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `TRT_VIAL#${now}`,
      concentrationMgMl,
      volumeMl,
      remainingMl,
      lotNumber: body.lotNumber || '',
      expiryDate,
      openedDate: body.openedDate || null,
      status: vialStatus,
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      entityType: 'TRT_VIAL',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created TRT vial ${vialId} for user ${userId} (status: ${vialStatus})`);

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
          concentrationMgMl,
          volumeMl,
          remainingMl,
          lotNumber: item.lotNumber,
          expiryDate,
          openedDate: item.openedDate,
          status: vialStatus,
          notes: item.notes,
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating TRT vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create TRT vial',
        message: error.message,
      }),
    };
  }
};
