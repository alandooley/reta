const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/injections/{id}
 * Deletes an injection record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/injections called:', JSON.stringify(event, null, 2));

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

    // Extract injection ID from path parameters
    const injectionId = event.pathParameters?.injectionId || event.pathParameters?.id;

    if (!injectionId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing injection ID in path',
        }),
      };
    }

    // Delete the injection
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `INJECTION#${injectionId}`,
      },
    }));

    console.log(`Deleted injection ${injectionId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Injection deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting injection:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete injection',
        message: error.message,
      }),
    };
  }
};
