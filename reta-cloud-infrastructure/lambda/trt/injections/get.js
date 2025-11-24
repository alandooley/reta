const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /v1/trt/injections
 * Retrieves all TRT injections for the authenticated user
 */
exports.handler = async (event) => {
  console.log('GET /v1/trt/injections called:', JSON.stringify(event, null, 2));

  try {
    // Extract user ID from authorizer context (HTTP API v2 SIMPLE format)
    const userId = event.requestContext?.authorizer?.lambda?.userId;

    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Unauthorized' }),
      };
    }

    // Query TRT injections for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'TRT_INJECTION#',
      },
      ScanIndexForward: false, // Most recent first
    };

    const result = await docClient.send(new QueryCommand(params));

    // Transform DynamoDB items to application format
    const injections = result.Items?.map(item => {
      const injection = {
        id: item.SK.replace('TRT_INJECTION#', ''),
        timestamp: item.timestamp,
        volumeMl: item.volumeMl,
        concentrationMgMl: item.concentrationMgMl,
        doseMg: item.doseMg,
        injectionSite: item.injectionSite,
        timeOfDay: item.timeOfDay || null,
        techniqueNotes: item.techniqueNotes || '',
        notes: item.notes || '',
        vialId: item.vialId || null,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        skipped: item.skipped || false,
      };

      // Add planned fields if present (for skipped injections)
      if (item.plannedVolumeMl) {
        injection.plannedVolumeMl = item.plannedVolumeMl;
      }
      if (item.plannedDoseMg) {
        injection.plannedDoseMg = item.plannedDoseMg;
      }

      return injection;
    }) || [];

    console.log(`Retrieved ${injections.length} TRT injections for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: injections,
        count: injections.length,
      }),
    };

  } catch (error) {
    console.error('Error retrieving TRT injections:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve TRT injections',
        message: error.message,
      }),
    };
  }
};
