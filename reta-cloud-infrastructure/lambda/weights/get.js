const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /v1/weights
 * Retrieves all weight entries for the authenticated user
 */
exports.handler = async (event) => {
  console.log('GET /v1/weights called:', JSON.stringify(event, null, 2));

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

    // Query weights for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'WEIGHT#',
      },
      ScanIndexForward: false, // Most recent first
    };

    const result = await docClient.send(new QueryCommand(params));

    // Transform DynamoDB items to application format
    const weights = result.Items?.map(item => ({
      id: item.SK.replace('WEIGHT#', ''),
      timestamp: item.timestamp,
      weightKg: item.weightKg,
      notes: item.notes || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })) || [];

    console.log(`Retrieved ${weights.length} weight entries for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: weights,
        count: weights.length,
      }),
    };

  } catch (error) {
    console.error('Error retrieving weights:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve weights',
        message: error.message,
      }),
    };
  }
};
