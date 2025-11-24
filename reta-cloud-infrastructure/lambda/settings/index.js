const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

/**
 * Combined handler for GET and POST /v1/settings
 * Manages user settings (both Reta and TRT) in DynamoDB
 */
exports.handler = async (event) => {
  console.log('Settings endpoint called:', JSON.stringify(event, null, 2));

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

    const method = event.requestContext.http.method;

    // Handle GET request
    if (method === 'GET') {
      return await handleGet(userId);
    }

    // Handle POST request
    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      return await handlePost(userId, body);
    }

    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: 'Method not allowed' }),
    };

  } catch (error) {
    console.error('Error handling settings request:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to process settings',
        message: error.message,
      }),
    };
  }
};

/**
 * GET /v1/settings
 * Retrieves user settings from DynamoDB
 */
async function handleGet(userId) {
  try {
    const params = {
      TableName: process.env.TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: 'SETTINGS#main',
      },
    };

    const result = await docClient.send(new GetCommand(params));

    if (!result.Item) {
      // Return default settings if none exist
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          success: true,
          data: getDefaultSettings(),
        }),
      };
    }

    // Extract settings from DynamoDB item
    const settings = {
      // Reta settings
      defaultDose: result.Item.defaultDose,
      injectionFrequencyDays: result.Item.injectionFrequencyDays,
      heightCm: result.Item.heightCm,
      goalWeightKg: result.Item.goalWeightKg,
      prefillDoseFrom: result.Item.prefillDoseFrom,

      // TRT settings
      trtSettings: {
        injectionFrequency: result.Item.trtInjectionFrequency,
        defaultDoseMl: result.Item.trtDefaultDoseMl,
        defaultDoseMg: result.Item.trtDefaultDoseMg,
        concentrationMgMl: result.Item.trtConcentrationMgMl,
        injectionSites: result.Item.trtInjectionSites,
      },

      updatedAt: result.Item.updatedAt,
    };

    console.log(`Retrieved settings for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: settings,
      }),
    };

  } catch (error) {
    console.error('Error retrieving settings:', error);
    throw error;
  }
}

/**
 * POST /v1/settings
 * Updates user settings in DynamoDB
 */
async function handlePost(userId, settings) {
  try {
    const now = new Date().toISOString();

    // Build the item with all settings
    const item = {
      PK: `USER#${userId}`,
      SK: 'SETTINGS#main',
      entityType: 'SETTINGS',

      // Reta settings
      defaultDose: settings.defaultDose ?? null,
      injectionFrequencyDays: settings.injectionFrequencyDays ?? null,
      heightCm: settings.heightCm ?? null,
      goalWeightKg: settings.goalWeightKg ?? null,
      prefillDoseFrom: settings.prefillDoseFrom ?? null,

      // TRT settings
      trtInjectionFrequency: settings.trtSettings?.injectionFrequency ?? null,
      trtDefaultDoseMl: settings.trtSettings?.defaultDoseMl ?? null,
      trtDefaultDoseMg: settings.trtSettings?.defaultDoseMg ?? null,
      trtConcentrationMgMl: settings.trtSettings?.concentrationMgMl ?? null,
      trtInjectionSites: settings.trtSettings?.injectionSites ?? null,

      updatedAt: now,
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.TABLE_NAME,
      Item: item,
    }));

    console.log(`Updated settings for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: {
          message: 'Settings updated successfully',
          updatedAt: now,
        },
      }),
    };

  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
}

/**
 * Default settings returned when no settings exist in DB
 */
function getDefaultSettings() {
  return {
    // Reta defaults
    defaultDose: 2.0,
    injectionFrequencyDays: 7,
    heightCm: null,
    goalWeightKg: null,
    prefillDoseFrom: 'lastShot',

    // TRT defaults
    trtSettings: {
      injectionFrequency: 3.5,
      defaultDoseMl: 0.5,
      defaultDoseMg: 100,
      concentrationMgMl: 200,
      injectionSites: [
        'left_ventrogluteal',
        'right_ventrogluteal',
        'left_deltoid',
        'right_deltoid',
        'left_vastus_lateralis',
        'right_vastus_lateralis'
      ],
    },
  };
}
