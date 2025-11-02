const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/weights/{id}
 * Deletes a weight record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/weights called:', JSON.stringify(event, null, 2));

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

    // Extract weight ID from path parameters
    const weightId = event.pathParameters?.weightId || event.pathParameters?.id;

    if (!weightId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing weight ID in path',
        }),
      };
    }

    // Delete the weight
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `WEIGHT#${weightId}`,
      },
    }));

    console.log(`Deleted weight ${weightId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Weight deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting weight:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete weight',
        message: error.message,
      }),
    };
  }
};
