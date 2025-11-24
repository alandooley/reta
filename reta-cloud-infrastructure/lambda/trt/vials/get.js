const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /v1/trt/vials
 * Retrieves all TRT vials for the authenticated user
 */
exports.handler = async (event) => {
  console.log('GET /v1/trt/vials called:', JSON.stringify(event, null, 2));

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

    // Query TRT vials for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TRT_VIAL#',
      },
      ScanIndexForward: false, // Most recent first
    };

    const result = await docClient.send(new QueryCommand(params));

    // Transform DynamoDB items to application format
    const vials = result.Items?.map(item => ({
      id: item.SK.replace('TRT_VIAL#', ''),
      concentrationMgMl: item.concentrationMgMl,
      volumeMl: item.volumeMl,
      remainingMl: item.remainingMl,
      lotNumber: item.lotNumber || '',
      expiryDate: item.expiryDate || null,
      openedDate: item.openedDate || null,
      status: item.status,
      notes: item.notes || '',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })) || [];

    console.log(`Retrieved ${vials.length} TRT vials for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: vials,
        count: vials.length,
      }),
    };

  } catch (error) {
    console.error('Error retrieving TRT vials:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve TRT vials',
        message: error.message,
      }),
    };
  }
};
