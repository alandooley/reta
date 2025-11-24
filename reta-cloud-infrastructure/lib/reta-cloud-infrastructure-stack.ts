import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { HttpApi, HttpMethod, CorsHttpMethod } from '@aws-cdk/aws-apigatewayv2-alpha';
import { HttpLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';

export class RetaCloudInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================
    // ULTRA-BUDGET CONFIGURATION
    // Target Cost: $0.30-1.00/month
    // ============================================

    // DynamoDB Table (Budget: No PITR, On-Demand billing)
    const table = new dynamodb.Table(this, 'RetatrutideTable', {
      tableName: 'retatrutide-tracker-prod',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-Demand for low usage
      pointInTimeRecovery: false, // 💰 DISABLED to save $0.20/month
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Safety: don't delete on stack destroy
    });

    // GSI for timestamp queries
    table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });

    // S3 Bucket for Frontend (Budget: Standard storage)
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `retatrutide-frontend-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // S3 Bucket for Backups (Budget: Keep only 4 most recent, managed by Lambda)
    const backupBucket = new s3.Bucket(this, 'BackupBucket', {
      bucketName: `retatrutide-backups-${this.account}`,
      versioned: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'FallbackCleanup',
          enabled: true,
          expiration: cdk.Duration.days(60), // Fallback: delete after 60 days if Lambda cleanup fails
        },
      ],
    });

    // Origin Access Control for CloudFront -> S3
    const oac = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
      originAccessControlConfig: {
        name: 'RetatrutideOAC',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // CloudFront Distribution (Budget: No custom domain)
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, 'CachePolicy', {
          cachePolicyName: 'RetatrutideCachePolicy',
          defaultTtl: cdk.Duration.days(365), // 💰 Cache for 1 year
          maxTtl: cdk.Duration.days(365),
          minTtl: cdk.Duration.days(1),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
        }),
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // Grant CloudFront access to S3 bucket
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [frontendBucket.arnForObjects('*')],
      conditions: {
        StringEquals: {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
        },
      },
    }));

    // Firebase Secret (placeholder - will be created manually)
    const firebaseSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'FirebaseSecret',
      'firebase-service-account'
    );

    // Lambda Execution Role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Lambda access to DynamoDB
    table.grantReadWriteData(lambdaRole);

    // Grant Lambda access to Secrets Manager
    firebaseSecret.grantRead(lambdaRole);

    // Grant Lambda access to S3 backups
    backupBucket.grantReadWrite(lambdaRole);

    // Common Lambda environment variables
    const commonLambdaEnv = {
      TABLE_NAME: table.tableName,
      FIREBASE_SECRET_NAME: firebaseSecret.secretName,
      BACKUP_BUCKET: backupBucket.bucketName,
      NODE_ENV: 'production',
    };

    // Common Lambda props (Budget: ARM64 + 256MB + 3-day logs)
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      architecture: lambda.Architecture.ARM_64, // 💰 20% cheaper + faster
      memorySize: 256, // 💰 Reduced from 512MB
      timeout: cdk.Duration.seconds(10),
      environment: commonLambdaEnv,
      role: lambdaRole,
      logRetention: logs.RetentionDays.THREE_DAYS, // 💰 3 days instead of 7
    };

    // Lambda Functions (using external code with dependencies)
    const path = require('path');

    const authorizerFn = new lambda.Function(this, 'AuthorizerFunction', {
      ...commonLambdaProps,
      functionName: 'reta-authorizer',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/authorizer')),
      handler: 'index.handler',
    });

    const getInjectionsFn = new lambda.Function(this, 'GetInjectionsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-injections',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/injections')),
      handler: 'get.handler',
    });

    const createInjectionFn = new lambda.Function(this, 'CreateInjectionFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-injection',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/injections')),
      handler: 'post.handler',
    });

    const deleteInjectionFn = new lambda.Function(this, 'DeleteInjectionFunction', {
      ...commonLambdaProps,
      functionName: 'reta-delete-injection',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/injections')),
      handler: 'delete.handler',
    });

    const getVialsFn = new lambda.Function(this, 'GetVialsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-vials',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/vials')),
      handler: 'get.handler',
    });

    const createVialFn = new lambda.Function(this, 'CreateVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/vials')),
      handler: 'post.handler',
    });

    const deleteVialFn = new lambda.Function(this, 'DeleteVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-delete-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/vials')),
      handler: 'delete.handler',
    });

    const updateVialFn = new lambda.Function(this, 'UpdateVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-update-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/vials')),
      handler: 'patch.handler',
    });

    const getWeightsFn = new lambda.Function(this, 'GetWeightsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-weights',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/weights')),
      handler: 'get.handler',
    });

    const createWeightFn = new lambda.Function(this, 'CreateWeightFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-weight',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/weights')),
      handler: 'post.handler',
    });

    const deleteWeightFn = new lambda.Function(this, 'DeleteWeightFunction', {
      ...commonLambdaProps,
      functionName: 'reta-delete-weight',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/weights')),
      handler: 'delete.handler',
    });

    const syncDataFn = new lambda.Function(this, 'SyncDataFunction', {
      ...commonLambdaProps,
      functionName: 'reta-sync-data',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/sync')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30), // Longer timeout for bulk operations
    });

    const getBackupFn = new lambda.Function(this, 'GetBackupFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-backup',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/backup')),
      handler: 'get.handler',
    });

    const createBackupFn = new lambda.Function(this, 'CreateBackupFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-backup',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/backup')),
      handler: 'create.handler',
    });

    const getVersionFn = new lambda.Function(this, 'GetVersionFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-version',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/version')),
      handler: 'version.handler',
    });

    const settingsFn = new lambda.Function(this, 'SettingsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-settings',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/settings')),
      handler: 'index.handler',
    });

    // ===== TRT Lambda Functions =====
    const getTrtInjectionsFn = new lambda.Function(this, 'GetTrtInjectionsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-trt-injections',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/injections')),
      handler: 'get.handler',
    });

    const createTrtInjectionFn = new lambda.Function(this, 'CreateTrtInjectionFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-trt-injection',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/injections')),
      handler: 'post.handler',
    });

    const deleteTrtInjectionFn = new lambda.Function(this, 'DeleteTrtInjectionFunction', {
      ...commonLambdaProps,
      functionName: 'reta-delete-trt-injection',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/injections')),
      handler: 'delete.handler',
    });

    const getTrtVialsFn = new lambda.Function(this, 'GetTrtVialsFunction', {
      ...commonLambdaProps,
      functionName: 'reta-get-trt-vials',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/vials')),
      handler: 'get.handler',
    });

    const createTrtVialFn = new lambda.Function(this, 'CreateTrtVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-create-trt-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/vials')),
      handler: 'post.handler',
    });

    const deleteTrtVialFn = new lambda.Function(this, 'DeleteTrtVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-delete-trt-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/vials')),
      handler: 'delete.handler',
    });

    const updateTrtVialFn = new lambda.Function(this, 'UpdateTrtVialFunction', {
      ...commonLambdaProps,
      functionName: 'reta-update-trt-vial',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/trt/vials')),
      handler: 'patch.handler',
    });

    // HTTP API Gateway (Budget: 60% cheaper than REST API)
    const httpApi = new HttpApi(this, 'RetatrutideHttpApi', {
      apiName: 'retatrutide-tracker-api',
      description: 'Ultra-budget HTTP API for Retatrutide tracking',
      corsPreflight: {
        allowOrigins: ['*'], // Will update to specific CloudFront URL after deploy
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE,
          CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge: cdk.Duration.hours(1),
      },
    });

    // Lambda Authorizer for Firebase Authentication
    const authorizer = new HttpLambdaAuthorizer('FirebaseAuthorizer', authorizerFn, {
      authorizerName: 'FirebaseAuthorizer',
      responseTypes: [HttpLambdaResponseType.SIMPLE], // Use SIMPLE for HTTP API v2 context passing
      resultsCacheTtl: cdk.Duration.minutes(5), // Cache authorization results for 5 minutes
      identitySource: ['$request.header.Authorization'],
    });

    // API Routes
    const v1 = '/v1';

    // Injections
    httpApi.addRoutes({
      path: `${v1}/injections`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetInjectionsIntegration', getInjectionsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/injections`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateInjectionIntegration', createInjectionFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/injections/{injectionId}`,
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteInjectionIntegration', deleteInjectionFn),
      authorizer,
    });

    // Vials
    httpApi.addRoutes({
      path: `${v1}/vials`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetVialsIntegration', getVialsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/vials`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateVialIntegration', createVialFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/vials/{vialId}`,
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteVialIntegration', deleteVialFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/vials/{vialId}`,
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('UpdateVialIntegration', updateVialFn),
      authorizer,
    });

    // Weights
    httpApi.addRoutes({
      path: `${v1}/weights`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetWeightsIntegration', getWeightsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/weights`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateWeightIntegration', createWeightFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/weights/{weightId}`,
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteWeightIntegration', deleteWeightFn),
      authorizer,
    });

    // Sync
    httpApi.addRoutes({
      path: `${v1}/sync`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('SyncDataIntegration', syncDataFn),
      authorizer,
    });

    // Backup
    httpApi.addRoutes({
      path: `${v1}/backup`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetBackupIntegration', getBackupFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/backup`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateBackupIntegration', createBackupFn),
      authorizer,
    });

    // Version endpoint (no auth required)
    httpApi.addRoutes({
      path: `${v1}/version`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetVersionIntegration', getVersionFn),
    });

    // Settings
    httpApi.addRoutes({
      path: `${v1}/settings`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetSettingsIntegration', settingsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/settings`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('UpdateSettingsIntegration', settingsFn),
      authorizer,
    });

    // ===== TRT API Routes =====
    // TRT Injections
    httpApi.addRoutes({
      path: `${v1}/trt/injections`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetTrtInjectionsIntegration', getTrtInjectionsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/trt/injections`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateTrtInjectionIntegration', createTrtInjectionFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/trt/injections/{injectionId}`,
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteTrtInjectionIntegration', deleteTrtInjectionFn),
      authorizer,
    });

    // TRT Vials
    httpApi.addRoutes({
      path: `${v1}/trt/vials`,
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('GetTrtVialsIntegration', getTrtVialsFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/trt/vials`,
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('CreateTrtVialIntegration', createTrtVialFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/trt/vials/{vialId}`,
      methods: [HttpMethod.DELETE],
      integration: new HttpLambdaIntegration('DeleteTrtVialIntegration', deleteTrtVialFn),
      authorizer,
    });

    httpApi.addRoutes({
      path: `${v1}/trt/vials/{vialId}`,
      methods: [HttpMethod.PATCH],
      integration: new HttpLambdaIntegration('UpdateTrtVialIntegration', updateTrtVialFn),
      authorizer,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API endpoint URL',
      exportName: 'RetaApiEndpoint',
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL (use this for your app)',
      exportName: 'RetaCloudFrontUrl',
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket name for frontend deployment',
      exportName: 'RetaFrontendBucket',
    });

    new cdk.CfnOutput(this, 'BackupBucketName', {
      value: backupBucket.bucketName,
      description: 'S3 bucket name for backups',
      exportName: 'RetaBackupBucket',
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: table.tableName,
      description: 'DynamoDB table name',
      exportName: 'RetaDynamoDBTable',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID (for cache invalidation)',
      exportName: 'RetaDistributionId',
    });
  }
}
