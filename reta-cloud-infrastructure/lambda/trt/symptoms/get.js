const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /v1/trt/symptoms
 * Retrieves all TRT symptom check-ins for the authenticated user
 */
exports.handler = async (event) => {
  console.log('GET /v1/trt/symptoms called:', JSON.stringify(event, null, 2));

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

    // Query TRT symptoms for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TRT_SYMPTOM#',
      },
      ScanIndexForward: false, // Most recent first
    };

    const result = await docClient.send(new QueryCommand(params));

    // Transform DynamoDB items to application format
    const symptoms = result.Items?.map(item => ({
      id: item.SK.replace('TRT_SYMPTOM#', ''),
      timestamp: item.timestamp,
      energyLevel: item.energyLevel,
      mood: item.mood,
      libido: item.libido,
      sleepQuality: item.sleepQuality,
      notes: item.notes || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })) || [];

    console.log(`Retrieved ${symptoms.length} symptom check-ins for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: symptoms,
      }),
    };

  } catch (error) {
    console.error('Error retrieving TRT symptoms:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve symptom check-ins',
        message: error.message,
      }),
    };
  }
};
