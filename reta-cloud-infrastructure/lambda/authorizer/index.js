const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Cache Firebase Admin SDK and credentials
let admin = null;
let firebaseApp = null;

/**
 * Lambda Authorizer for Firebase Authentication
 * Validates Firebase ID tokens and returns authorization decision
 * Using SIMPLE response format for HTTP API v2
 */
exports.handler = async (event) => {
  console.log('Authorizer invoked:', JSON.stringify(event, null, 2));

  try {
    // Extract token from Authorization header
    const token = extractToken(event);
    if (!token) {
      console.error('No token provided');
      return { isAuthorized: false };
    }

    // Initialize Firebase Admin SDK (cached after first invocation)
    if (!admin || !firebaseApp) {
      await initializeFirebase();
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('Token verified successfully for user:', decodedToken.uid);

    // Return SIMPLE response format for HTTP API v2
    const response = {
      isAuthorized: true,
      context: {
        userId: decodedToken.uid,
        email: decodedToken.email || '',
        emailVerified: decodedToken.email_verified ? 'true' : 'false',
      },
    };

    console.log('Generated authorization response:', JSON.stringify(response, null, 2));
    return response;

  } catch (error) {
    console.error('Authorization error:', error);

    // Return Deny response on any error
    return { isAuthorized: false };
  }
};

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;

  if (!authHeader) {
    return null;
  }

  // Extract token from "Bearer <token>" format
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }

  return null;
}

/**
 * Initialize Firebase Admin SDK
 * Fetches service account credentials from Secrets Manager
 */
async function initializeFirebase() {
  console.log('Initializing Firebase Admin SDK...');

  // Lazy load Firebase Admin SDK
  admin = require('firebase-admin');

  // Fetch Firebase service account from Secrets Manager
  const secretName = process.env.FIREBASE_SECRET_NAME;
  const secretsManager = new SecretsManagerClient({ region: process.env.AWS_REGION });

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await secretsManager.send(command);

  if (!response.SecretString) {
    throw new Error('Firebase service account secret is empty');
  }

  const serviceAccount = JSON.parse(response.SecretString);

  // Initialize Firebase app
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('Firebase Admin SDK initialized successfully');
}
