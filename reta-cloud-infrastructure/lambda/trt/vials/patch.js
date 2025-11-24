const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * PATCH /v1/trt/vials/{id}
 * Updates a TRT vial record for the authenticated user
 * Supports partial updates to any field
 */
exports.handler = async (event) => {
  console.log('PATCH /v1/trt/vials called:', JSON.stringify(event, null, 2));

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

    // Extract vial ID from path parameters
    const vialId = event.pathParameters?.vialId || event.pathParameters?.id;

    if (!vialId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing vial ID in path',
        }),
      };
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Build update expression dynamically based on provided fields
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    const now = new Date().toISOString();

    // Always update updatedAt
    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = now;

    // Handle optional fields
    if (body.remainingMl !== undefined) {
      updateExpressions.push('#remainingMl = :remainingMl');
      expressionAttributeNames['#remainingMl'] = 'remainingMl';
      expressionAttributeValues[':remainingMl'] = body.remainingMl;
    }

    if (body.status !== undefined) {
      updateExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = body.status;
    }

    if (body.notes !== undefined) {
      updateExpressions.push('#notes = :notes');
      expressionAttributeNames['#notes'] = 'notes';
      expressionAttributeValues[':notes'] = body.notes;
    }

    if (body.openedDate !== undefined) {
      updateExpressions.push('#openedDate = :openedDate');
      expressionAttributeNames['#openedDate'] = 'openedDate';
      expressionAttributeValues[':openedDate'] = body.openedDate;
    }

    if (body.lotNumber !== undefined) {
      updateExpressions.push('#lotNumber = :lotNumber');
      expressionAttributeNames['#lotNumber'] = 'lotNumber';
      expressionAttributeValues[':lotNumber'] = body.lotNumber;
    }

    if (body.expiryDate !== undefined) {
      updateExpressions.push('#expiryDate = :expiryDate');
      expressionAttributeNames['#expiryDate'] = 'expiryDate';
      expressionAttributeValues[':expiryDate'] = body.expiryDate;
    }

    if (body.concentrationMgMl !== undefined) {
      updateExpressions.push('#concentrationMgMl = :concentrationMgMl');
      expressionAttributeNames['#concentrationMgMl'] = 'concentrationMgMl';
      expressionAttributeValues[':concentrationMgMl'] = body.concentrationMgMl;
    }

    if (body.volumeMl !== undefined) {
      updateExpressions.push('#volumeMl = :volumeMl');
      expressionAttributeNames['#volumeMl'] = 'volumeMl';
      expressionAttributeValues[':volumeMl'] = body.volumeMl;
    }

    // If no fields to update besides updatedAt, return error
    if (updateExpressions.length === 1) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'No fields to update',
        }),
      };
    }

    // Update the vial
    await docClient.send(new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_VIAL#${vialId}`,
      },
      UpdateExpression: 'SET ' + updateExpressions.join(', '),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    console.log(`Updated TRT vial ${vialId} for user ${userId}`);

    // Fetch updated vial to return
    const result = await docClient.send(new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_VIAL#${vialId}`,
      },
    }));

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Vial not found after update',
        }),
      };
    }

    // Return updated vial
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: vialId,
          concentrationMgMl: result.Item.concentrationMgMl,
          volumeMl: result.Item.volumeMl,
          remainingMl: result.Item.remainingMl,
          lotNumber: result.Item.lotNumber || '',
          expiryDate: result.Item.expiryDate,
          openedDate: result.Item.openedDate || null,
          status: result.Item.status,
          notes: result.Item.notes || '',
          createdAt: result.Item.createdAt,
          updatedAt: result.Item.updatedAt,
        },
      }),
    };

  } catch (error) {
    console.error('Error updating TRT vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to update TRT vial',
        message: error.message,
      }),
    };
  }
};
