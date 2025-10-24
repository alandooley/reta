const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * GET /v1/backup/{key}
 * Retrieves a specific backup file
 */
exports.handler = async (event) => {
  console.log('GET /v1/backup called:', JSON.stringify(event, null, 2));

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

    // Extract backup key from path or query parameters
    const backupKey = event.pathParameters?.key || event.queryStringParameters?.key;

    if (!backupKey) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Missing backup key',
        }),
      };
    }

    // Ensure the backup belongs to the authenticated user
    if (!backupKey.startsWith(`${userId}/`)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Access denied: backup does not belong to user',
        }),
      };
    }

    // Retrieve backup from S3
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.BACKUP_BUCKET,
      Key: backupKey,
    }));

    // Stream to string
    const backupData = await streamToString(response.Body);
    const backup = JSON.parse(backupData);

    console.log(`Retrieved backup ${backupKey} for user ${userId}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: backup,
      }),
    };

  } catch (error) {
    console.error('Error retrieving backup:', error);

    if (error.name === 'NoSuchKey') {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Backup not found',
        }),
      };
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to retrieve backup',
        message: error.message,
      }),
    };
  }
};

/**
 * Helper to convert readable stream to string
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
