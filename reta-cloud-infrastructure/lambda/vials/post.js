const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * POST /v1/vials
 * Creates a new vial record for the authenticated user
 * Supports NEW schema (orderDate, totalMg, supplier) for dry_stock vials
 */
exports.handler = async (event) => {
  console.log('POST /v1/vials called:', JSON.stringify(event, null, 2));

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

    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // NEW SCHEMA validation (for dry_stock vials)
    const { id, orderDate, totalMg, supplier, status } = body;
    if (!orderDate || totalMg === undefined) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing required fields: orderDate, totalMg',
        }),
      };
    }

    // Validate totalMg is non-negative
    if (typeof totalMg !== 'number' || totalMg < 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'totalMg must be a non-negative number',
        }),
      };
    }

    // Use provided ID or generate new one
    const vialId = id || randomUUID();
    const now = new Date().toISOString();

    // Create vial item (using camelCase to match existing DynamoDB data)
    const item = {
      PK: `USER#${userId}`,
      SK: `VIAL#${vialId}`,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `VIAL#${orderDate}`,
      vial_id: vialId,
      orderDate: orderDate,
      totalMg: totalMg,
      supplier: supplier || '',
      status: status || 'dry_stock',
      // Activation fields (null until activated)
      reconstitutionDate: body.reconstitutionDate || null,
      expirationDate: body.expirationDate || null,
      bacWaterMl: body.bacWaterMl || null,
      concentrationMgMl: body.concentrationMgMl || null,
      currentVolumeMl: body.currentVolumeMl || 0,
      remainingMl: body.remainingMl || 0,
      usedVolumeMl: body.usedVolumeMl || 0,
      dosesUsed: body.dosesUsed || 0,
      lotNumber: body.lotNumber || '',
      notes: body.notes || '',
      createdAt: now,
      updatedAt: now,
      entityType: 'VIAL',
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Created vial ${vialId} for user ${userId} (status: ${item.status})`);

    // Return created vial (frontend expects snake_case)
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          id: vialId,
          vial_id: vialId,
          order_date: item.orderDate,
          total_mg: item.totalMg,
          supplier: item.supplier,
          status: item.status,
          reconstitution_date: item.reconstitutionDate,
          expiration_date: item.expirationDate,
          bac_water_ml: item.bacWaterMl,
          concentration_mg_ml: item.concentrationMgMl,
          current_volume_ml: item.currentVolumeMl,
          remaining_ml: item.remainingMl,
          used_volume_ml: item.usedVolumeMl,
          doses_used: item.dosesUsed,
          lot_number: item.lotNumber,
          notes: item.notes,
          createdAt: now,
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error creating vial:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create vial',
        message: error.message,
      }),
    };
  }
};
