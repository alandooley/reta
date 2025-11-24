const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/trt/vials/{id}
 * Deletes a TRT vial record for the authenticated user
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/trt/vials called:', JSON.stringify(event, null, 2));

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

    // Delete the vial (allow deletion even if referenced by injections - they'll keep the vialId for historical records)
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_VIAL#${vialId}`,
      },
    }));

    console.log(`Deleted TRT vial ${vialId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'TRT vial deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting TRT vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete TRT vial',
        message: error.message,
      }),
    };
  }
};
