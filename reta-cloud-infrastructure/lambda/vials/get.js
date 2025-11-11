const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * GET /v1/vials
 * Retrieves all vials for the authenticated user
 */
exports.handler = async (event) => {
  console.log('GET /v1/vials called:', JSON.stringify(event, null, 2));

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

    // Query vials for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':sk': 'VIAL#',
      },
      ScanIndexForward: false, // Most recent first
    };

    const result = await docClient.send(new QueryCommand(params));

    // Transform DynamoDB items to application format
    // Note: DynamoDB stores in camelCase (orderDate, totalMg, etc.)
    // but frontend expects snake_case (order_date, total_mg, etc.)
    const vials = result.Items?.map(item => ({
      vial_id: item.vial_id || item.SK.replace('VIAL#', ''),
      order_date: item.orderDate || item.order_date,
      reconstitution_date: item.reconstitutionDate || item.reconstitution_date,
      expiration_date: item.expirationDate || item.expiration_date,
      total_mg: item.totalMg || item.total_mg,
      bac_water_ml: item.bacWaterMl || item.bac_water_ml,
      concentration_mg_ml: item.concentrationMgMl || item.concentration_mg_ml,
      current_volume_ml: item.currentVolumeMl || item.current_volume_ml,
      status: item.status,
      supplier: item.supplier || '',
      lot_number: item.lotNumber || item.lot_number || '',
      doses_used: item.dosesUsed || item.doses_used || 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      notes: item.notes || '',
      used_volume_ml: item.usedVolumeMl || item.used_volume_ml,
    })) || [];

    console.log(`Retrieved ${vials.length} vials for user ${userId}`);

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
    console.error('Error retrieving vials:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve vials',
        message: error.message,
      }),
    };
  }
};
