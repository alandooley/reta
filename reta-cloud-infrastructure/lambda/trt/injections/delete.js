const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/trt/injections/{id}
 * Deletes a TRT injection record for the authenticated user
 * Restores vial volume if the injection was linked to a vial
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/trt/injections called:', JSON.stringify(event, null, 2));

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

    // First, get the injection to check if it has a vialId
    const getResult = await docClient.send(new GetCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_INJECTION#${injectionId}`,
      },
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Injection not found',
        }),
      };
    }

    const injection = getResult.Item;

    // Delete the injection
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_INJECTION#${injectionId}`,
      },
    }));

    // If injection had a vialId and wasn't skipped, restore the volume
    if (injection.vialId && !injection.skipped && injection.volumeMl > 0) {
      const now = new Date().toISOString();
      await docClient.send(new UpdateCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRT_VIAL#${injection.vialId}`,
        },
        UpdateExpression: 'SET remainingMl = remainingMl + :volume, updatedAt = :now',
        ExpressionAttributeValues: {
          ':volume': injection.volumeMl,
          ':now': now,
        },
      }));

      console.log(`Restored vial ${injection.vialId}: added back ${injection.volumeMl}ml`);
    }

    console.log(`Deleted TRT injection ${injectionId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'TRT injection deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting TRT injection:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete TRT injection',
        message: error.message,
      }),
    };
  }
};
