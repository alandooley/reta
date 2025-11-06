const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * PATCH /v1/vials/{id}
 * Updates a vial record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('PATCH /v1/vials called:', JSON.stringify(event, null, 2));

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
    if (body.currentVolumeMl !== undefined) {
      updateExpressions.push('#currentVolumeMl = :currentVolumeMl');
      expressionAttributeNames['#currentVolumeMl'] = 'currentVolumeMl';
      expressionAttributeValues[':currentVolumeMl'] = body.currentVolumeMl;
    }

    if (body.usedVolumeMl !== undefined) {
      updateExpressions.push('#usedVolumeMl = :usedVolumeMl');
      expressionAttributeNames['#usedVolumeMl'] = 'usedVolumeMl';
      expressionAttributeValues[':usedVolumeMl'] = body.usedVolumeMl;
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

    if (updateExpressions.length === 1) {
      // Only updatedAt would be updated, which means no actual changes
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'No valid fields to update',
        }),
      };
    }

    // Update the vial
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `VIAL#${vialId}`,
      },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    }));

    console.log(`Updated vial ${vialId} for user ${userId}`);

    // Return updated vial
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: updateResult.Attributes,
      }),
    };

  } catch (error) {
    console.error('Error updating vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to update vial',
        message: error.message,
      }),
    };
  }
};
