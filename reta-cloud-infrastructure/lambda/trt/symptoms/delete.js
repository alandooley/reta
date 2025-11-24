const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * DELETE /v1/trt/symptoms/{id}
 * Deletes a TRT symptom check-in for the authenticated user
 */
exports.handler = async (event) => {
  console.log('DELETE /v1/trt/symptoms/{id} called:', JSON.stringify(event, null, 2));

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

    // Extract symptom ID from path
    const symptomId = event.pathParameters?.id;

    if (!symptomId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Symptom ID is required',
        }),
      };
    }

    // Delete from DynamoDB
    await docClient.send(new DeleteCommand({
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRT_SYMPTOM#${symptomId}`,
      },
    }));

    console.log(`Deleted TRT symptom ${symptomId} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Symptom check-in deleted successfully',
      }),
    };

  } catch (error) {
    console.error('Error deleting TRT symptom:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to delete symptom check-in',
        message: error.message,
      }),
    };
  }
};
