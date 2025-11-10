const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
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

    // Parse request body if provided (bulk upload before backup)
    let bodyData = null;
    if (event.body) {
      try {
        bodyData = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      } catch (e) {
        console.error('Failed to parse request body:', e);
      }
    }

    // If data provided, write it to DynamoDB first (bulk upload)
    if (bodyData) {
      console.log('Bulk uploading data before backup...');
      const timestamp = new Date().toISOString();

      // Write injections
      if (bodyData.injections && Array.isArray(bodyData.injections)) {
        for (const injection of bodyData.injections) {
          await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              PK: `USER#${userId}`,
              SK: `INJECTION#${injection.id}`,
              timestamp: injection.timestamp,
              doseMg: injection.dose_mg || injection.doseMg,
              site: injection.injection_site || injection.site,
              vialId: injection.vial_id || injection.vialId,
              notes: injection.notes || '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          }));
        }
        console.log(`Uploaded ${bodyData.injections.length} injections`);
      }

      // Write vials
      if (bodyData.vials && Array.isArray(bodyData.vials)) {
        for (const vial of bodyData.vials) {
          await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              PK: `USER#${userId}`,
              SK: `VIAL#${vial.vial_id || vial.id}`,
              orderDate: vial.order_date || vial.orderDate,
              reconstitutionDate: vial.reconstitution_date || vial.reconstitutionDate,
              expirationDate: vial.expiration_date || vial.expirationDate,
              totalMg: vial.total_mg || vial.totalMg,
              bacWaterMl: vial.bac_water_ml || vial.bacWaterMl,
              concentrationMgMl: vial.concentration_mg_ml || vial.concentrationMgMl,
              currentVolumeMl: vial.current_volume_ml || vial.currentVolumeMl,
              status: vial.status,
              supplier: vial.supplier || '',
              lotNumber: vial.lot_number || vial.lotNumber || '',
              dosesUsed: vial.doses_used || vial.dosesUsed || 0,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          }));
        }
        console.log(`Uploaded ${bodyData.vials.length} vials`);
      }

      // Write weights
      if (bodyData.weights && Array.isArray(bodyData.weights)) {
        for (const weight of bodyData.weights) {
          await docClient.send(new PutCommand({
            TableName: process.env.TABLE_NAME,
            Item: {
              PK: `USER#${userId}`,
              SK: `WEIGHT#${weight.id}`,
              timestamp: weight.timestamp,
              weightKg: weight.weight_kg || weight.weightKg,
              bodyFatPercentage: weight.body_fat_percentage || weight.bodyFatPercentage,
              notes: weight.notes || '',
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          }));
        }
        console.log(`Uploaded ${bodyData.weights.length} weights`);
      }

      console.log('Bulk upload complete');
    }

    // Query all data for this user (now includes newly uploaded data)
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
