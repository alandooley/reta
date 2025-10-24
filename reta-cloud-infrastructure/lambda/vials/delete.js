const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/vials/{id}
 * Deletes a vial record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/vials called:', JSON.stringify(event, null, 2));

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

    // Check if vial is referenced by any injections
    const injectionsCheck = await docClient.send(new QueryCommand({
      TableName: process.env.TABLE_NAME,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      FilterExpression: 'vialId = :vialId',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':vialId': vialId,
      },
      Limit: 1,
    }));

    if (injectionsCheck.Items && injectionsCheck.Items.length > 0) {
      return {
        statusCode: 409,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Cannot delete vial: it is referenced by one or more injections',
        }),
      };
    }

    // Delete the vial
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `VIAL#${vialId}`,
      },
    }));

    console.log(`Deleted vial ${vialId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Vial deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete vial',
        message: error.message,
      }),
    };
  }
};
