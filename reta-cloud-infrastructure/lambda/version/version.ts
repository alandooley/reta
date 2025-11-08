/**
 * Version Lambda Handler
 * Returns the current backend version
 */

const BACKEND_VERSION = '1.1.0';
const BUILD_DATE = '2025-11-08';

export const handler = async (event: any) => {
  console.log('Version check request:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify({
      version: BACKEND_VERSION,
      buildDate: BUILD_DATE,
      timestamp: new Date().toISOString()
    })
  };
};
