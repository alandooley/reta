/**
 * API Mock Utilities
 *
 * Provides functions to mock API calls and prevent actual network traffic during tests.
 * Uses Playwright's route interception to return mock responses.
 */

/**
 * Mock all API calls to return success responses
 */
async function mockApiSuccess(page) {
    // Mock vials endpoints
    await page.route('**/v1/vials', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: [],
                    count: 0
                })
            });
        } else if (method === 'POST') {
            const postData = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        id: postData.id || `mock-${Date.now()}`,
                        ...postData
                    }
                })
            });
        }
    });

    await page.route('**/v1/vials/*', async (route) => {
        const method = route.request().method();

        if (method === 'PATCH') {
            const postData = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: postData
                })
            });
        } else if (method === 'DELETE') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true
                })
            });
        }
    });

    // Mock injections endpoints
    await page.route('**/v1/injections', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: [],
                    count: 0
                })
            });
        } else if (method === 'POST') {
            const postData = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        id: postData.id || `mock-${Date.now()}`,
                        ...postData
                    }
                })
            });
        }
    });

    await page.route('**/v1/injections/*', async (route) => {
        const method = route.request().method();

        if (method === 'DELETE') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true
                })
            });
        }
    });

    // Mock weights endpoints
    await page.route('**/v1/weights', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: [],
                    count: 0
                })
            });
        } else if (method === 'POST') {
            const postData = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        id: postData.id || `mock-${Date.now()}`,
                        ...postData
                    }
                })
            });
        }
    });

    await page.route('**/v1/weights/*', async (route) => {
        const method = route.request().method();

        if (method === 'DELETE') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true
                })
            });
        }
    });

    // Mock settings endpoint
    await page.route('**/v1/settings', async (route) => {
        const method = route.request().method();

        if (method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {}
                })
            });
        } else if (method === 'POST') {
            const postData = JSON.parse(route.request().postData() || '{}');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: postData
                })
            });
        }
    });

    // Mock sync endpoint
    await page.route('**/v1/sync', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                message: 'Sync completed (mocked)'
            })
        });
    });

    // Mock backup endpoints
    await page.route('**/v1/backup', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                backup: { key: 'mock-backup-key' }
            })
        });
    });

    console.log('[API-MOCK] All API routes mocked to return success');
}

/**
 * Mock API to return errors
 */
async function mockApiError(page, statusCode = 500, errorMessage = 'Internal Server Error') {
    await page.route('**/v1/**', async (route) => {
        await route.fulfill({
            status: statusCode,
            contentType: 'application/json',
            body: JSON.stringify({
                success: false,
                error: errorMessage
            })
        });
    });

    console.log(`[API-MOCK] All API routes mocked to return ${statusCode} error`);
}

/**
 * Mock API to simulate network timeout
 */
async function mockApiTimeout(page, delayMs = 30000) {
    await page.route('**/v1/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        await route.abort('timedout');
    });

    console.log(`[API-MOCK] All API routes mocked to timeout after ${delayMs}ms`);
}

/**
 * Mock API to simulate intermittent failures (randomly succeeds or fails)
 */
async function mockApiIntermittent(page, failureRate = 0.5) {
    await page.route('**/v1/**', async (route) => {
        if (Math.random() < failureRate) {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: false,
                    error: 'Intermittent failure (simulated)'
                })
            });
        } else {
            // Let it through to default mock or real endpoint
            await route.continue();
        }
    });

    console.log(`[API-MOCK] API routes mocked with ${failureRate * 100}% failure rate`);
}

/**
 * Track API calls made during test
 */
async function trackApiCalls(page) {
    const apiCalls = [];

    await page.route('**/v1/**', async (route) => {
        const request = route.request();
        apiCalls.push({
            method: request.method(),
            url: request.url(),
            postData: request.postData(),
            timestamp: new Date().toISOString()
        });

        await route.continue();
    });

    return apiCalls;
}

/**
 * Verify NO API calls were made (true isolation test)
 */
async function verifyNoApiCalls(page) {
    let callsMade = false;

    await page.route('**/v1/**', async (route) => {
        callsMade = true;
        console.error(`[API-MOCK] Unexpected API call detected: ${route.request().method()} ${route.request().url()}`);
        await route.abort();
    });

    return {
        verify: () => {
            if (callsMade) {
                throw new Error('API calls were made when none were expected (test should run in complete isolation)');
            }
        }
    };
}

module.exports = {
    mockApiSuccess,
    mockApiError,
    mockApiTimeout,
    mockApiIntermittent,
    trackApiCalls,
    verifyNoApiCalls
};
