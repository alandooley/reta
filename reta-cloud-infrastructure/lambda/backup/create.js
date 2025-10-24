const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: process.env.AWS_REGION });

/**
 * POST /v1/backup
 * Creates a backup of all user data and uploads to S3
 */
exports.handler = async (event) => {
  console.log('POST /v1/backup called:', JSON.stringify(event, null, 2));

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

    // Query all data for this user
    const params = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
      },
    };

    const result = await docClient.send(new QueryCommand(params));
    const allItems = result.Items || [];

    // Separate items by type
    const backup = {
      userId,
      timestamp: new Date().toISOString(),
      injections: [],
      vials: [],
      weights: [],
    };

    allItems.forEach(item => {
      if (item.SK.startsWith('INJECTION#')) {
        backup.injections.push({
          id: item.SK.replace('INJECTION#', ''),
          timestamp: item.timestamp,
          doseMg: item.doseMg,
          site: item.site,
          notes: item.notes || '',
          vialId: item.vialId || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      } else if (item.SK.startsWith('VIAL#')) {
        backup.vials.push({
          id: item.SK.replace('VIAL#', ''),
          startDate: item.startDate,
          initialVolumeMl: item.initialVolumeMl,
          concentrationMgPerMl: item.concentrationMgPerMl,
          currentVolumeMl: item.currentVolumeMl,
          usedVolumeMl: item.usedVolumeMl,
          status: item.status,
          source: item.source || '',
          notes: item.notes || '',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      } else if (item.SK.startsWith('WEIGHT#')) {
        backup.weights.push({
          id: item.SK.replace('WEIGHT#', ''),
          timestamp: item.timestamp,
          weightKg: item.weightKg,
          notes: item.notes || '',
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    });

    // Create backup file key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupKey = `${userId}/backup-${timestamp}.json`;

    // Upload to S3
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.BACKUP_BUCKET,
      Key: backupKey,
      Body: JSON.stringify(backup, null, 2),
      ContentType: 'application/json',
      Metadata: {
        userId,
        timestamp: backup.timestamp,
        itemCount: String(
          backup.injections.length + backup.vials.length + backup.weights.length
        ),
      },
    }));

    console.log(`Created backup ${backupKey} for user ${userId}`);

    // Clean up old backups - keep only 4 most recent
    const listParams = {
      Bucket: process.env.BACKUP_BUCKET,
      Prefix: `${userId}/`,
    };

    const listResult = await s3Client.send(new ListObjectsV2Command(listParams));

    if (listResult.Contents && listResult.Contents.length > 4) {
      // Sort by LastModified (oldest first)
      const sortedBackups = listResult.Contents
        .sort((a, b) => a.LastModified - b.LastModified);

      // Delete all but the 4 most recent
      const backupsToDelete = sortedBackups.slice(0, sortedBackups.length - 4);

      for (const backup of backupsToDelete) {
        await s3Client.send(new DeleteObjectCommand({
          Bucket: process.env.BACKUP_BUCKET,
          Key: backup.Key,
        }));
        console.log(`Deleted old backup: ${backup.Key}`);
      }

      console.log(`Cleaned up ${backupsToDelete.length} old backups, kept 4 most recent`);
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        backup: {
          key: backupKey,
          timestamp: backup.timestamp,
          counts: {
            injections: backup.injections.length,
            vials: backup.vials.length,
            weights: backup.weights.length,
          },
        },
      }),
    };

  } catch (error) {
    console.error('Error creating backup:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Failed to create backup',
        message: error.message,
      }),
    };
  }
};
