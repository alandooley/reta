/**
 * Firebase Authentication Manager
 * Handles user authentication with Google Sign-In
 */

class AuthManager {
    constructor() {
        this.user = null;
        this.idToken = null;
        this.tokenExpiryTime = null;
        this.authStateListeners = [];
        this.initialized = false;
    }

    /**
     * Initialize Firebase Authentication
     */
    async initialize() {
        if (this.initialized) {
            return;
        }

        console.log('Initializing Firebase Auth...');

        // Firebase should already be initialized from index.html
        if (!window.firebase) {
            throw new Error('Firebase SDK not loaded');
        }

        // Set persistence based on browser capabilities
        // Try LOCAL first (best for most cases), fall back to SESSION if blocked
        try {
            // Test if localStorage is available (can fail in private mode or with strict cookies)
            const testKey = '__firebase_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);

            // localStorage works - use LOCAL persistence for best reliability
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('Firebase auth persistence set to LOCAL (localStorage available)');
        } catch (error) {
            // localStorage blocked - fall back to SESSION (uses sessionStorage)
            console.warn('localStorage not available, using SESSION persistence:', error.message);
            try {
                await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
                console.log('Firebase auth persistence set to SESSION (fallback)');
            } catch (sessionError) {
                console.error('Failed to set any persistence:', sessionError);
            }
        }

        // Check for redirect result first (for mobile/Safari compatibility)
        try {
            console.log('Checking for OAuth redirect result...');
            console.log('Current URL:', window.location.href);
            console.log('URL params:', window.location.search);

            const result = await firebase.auth().getRedirectResult();
            console.log('getRedirectResult() returned:', {
                hasResult: !!result,
                hasUser: !!result?.user,
                hasCredential: !!result?.credential,
                userEmail: result?.user?.email
            });

            if (result.user) {
                console.log('✅ Sign-in completed via redirect:', result.user.email);
                console.log('User UID:', result.user.uid);
                // Auth state listener will handle the rest
            } else if (result && !result.user) {
                console.log('⚠️ Redirect result returned but no user object');
            } else {
                console.log('ℹ️ No redirect result (normal for initial page load)');
            }
        } catch (error) {
            console.error('❌ Redirect result error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);

            // Handle missing initial state error specifically
            if (error.message.includes('missing initial state')) {
                console.error('⚠️ Missing initial state error - this usually means:');
                console.error('  1. Browser blocked cookies/storage during redirect');
                console.error('  2. User is in private/incognito mode');
                console.error('  3. Browser cleared storage between redirect steps');

                // Clear any stale auth state
                try {
                    await firebase.auth().signOut();
                } catch (e) {
                    // Ignore signout errors
                }

                // Store error info for user display
                sessionStorage.setItem('auth_error', JSON.stringify({
                    code: 'missing-initial-state',
                    message: 'Browser storage was blocked during sign-in. Please enable cookies and try again.',
                    timestamp: Date.now()
                }));
            } else if (error.code === 'auth/popup-closed-by-user' ||
                       error.code === 'auth/cancelled-popup-request') {
                console.log('Auth flow was cancelled by user');
            }
        }

        // Listen for auth state changes
        firebase.auth().onAuthStateChanged(async (user) => {
            console.log('Auth state changed:', user ? user.email : 'signed out');
            this.user = user;

            if (user) {
                // Get fresh ID token
                await this.refreshIdToken();
            } else {
                this.idToken = null;
                this.tokenExpiryTime = null;
            }

            // Notify all listeners
            this.notifyAuthStateChange(user);
        });

        // Set up automatic token refresh (every 50 minutes, tokens expire after 60 minutes)
        setInterval(() => {
            if (this.user) {
                this.refreshIdToken();
            }
        }, 50 * 60 * 1000);

        this.initialized = true;
    }

    /**
     * Sign in with Google (uses redirect for mobile/Safari compatibility)
     * @param {boolean} forcePopup - Force popup mode even on mobile (fallback for storage issues)
     */
    async signInWithGoogle(forcePopup = false) {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'  // Always show account picker
            });

            // Detect mobile device
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Use popup if forced or on desktop
            // Use redirect on mobile by default (better UX, but can have storage issues)
            if (forcePopup || !isMobile) {
                console.log('Starting Google sign-in via popup...');
                const result = await firebase.auth().signInWithPopup(provider);
                console.log('✅ Popup sign-in successful:', result.user.email);
            } else {
                console.log('Starting Google sign-in via redirect (mobile device)...');

                // Store a marker to detect if redirect fails
                try {
                    sessionStorage.setItem('auth_redirect_started', Date.now().toString());
                } catch (e) {
                    console.warn('Cannot write to sessionStorage:', e);
                }

                await firebase.auth().signInWithRedirect(provider);
                // Note: After redirect, the page will reload and initialize()
                // will call getRedirectResult() to complete the sign-in
            }
        } catch (error) {
            console.error('Sign in error:', error);

            // Provide helpful error messages for common issues
            if (error.code === 'auth/popup-blocked') {
                throw new Error('Sign-in popup was blocked. Please allow popups and try again.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in popup was closed. Please try again.');
            } else if (error.code === 'auth/operation-not-allowed') {
                throw new Error('Google sign-in is not enabled. Please contact support.');
            } else if (error.message.includes('missing initial state')) {
                // Offer popup mode as fallback
                throw new Error('Browser storage issue detected. Click "Try Popup Mode" button below or enable cookies.');
            } else {
                throw new Error(`Sign in failed: ${error.message}`);
            }
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            await firebase.auth().signOut();
            this.user = null;
            this.idToken = null;
            this.tokenExpiryTime = null;
            console.log('Signed out successfully');
        } catch (error) {
            console.error('Sign out error:', error);
            throw new Error(`Sign out failed: ${error.message}`);
        }
    }

    /**
     * Get current ID token (refreshes if expired)
     */
    async getIdToken(forceRefresh = false) {
        if (!this.user) {
            return null;
        }

        // Check if token is about to expire (within 5 minutes)
        const now = Date.now();
        const needsRefresh = forceRefresh ||
            !this.idToken ||
            !this.tokenExpiryTime ||
            (this.tokenExpiryTime - now) < (5 * 60 * 1000);

        if (needsRefresh) {
            await this.refreshIdToken();
        }

        return this.idToken;
    }

    /**
     * Refresh ID token from Firebase
     */
    async refreshIdToken() {
        if (!this.user) {
            return null;
        }

        try {
            this.idToken = await this.user.getIdToken(true);
            // Tokens expire after 1 hour
            this.tokenExpiryTime = Date.now() + (60 * 60 * 1000);
            console.log('ID token refreshed');
            return this.idToken;
        } catch (error) {
            console.error('Token refresh error:', error);
            throw error;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.user;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Get user ID
     */
    getUserId() {
        return this.user ? this.user.uid : null;
    }

    /**
     * Get user email
     */
    getUserEmail() {
        return this.user ? this.user.email : null;
    }

    /**
     * Add auth state change listener
     */
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);

        // Immediately call with current state
        if (this.initialized) {
            callback(this.user);
        }
    }

    /**
     * Remove auth state change listener
     */
    offAuthStateChange(callback) {
        const index = this.authStateListeners.indexOf(callback);
        if (index > -1) {
            this.authStateListeners.splice(index, 1);
        }
    }

    /**
     * Notify all listeners of auth state change
     */
    notifyAuthStateChange(user) {
        this.authStateListeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('Auth state listener error:', error);
            }
        });
    }

    /**
     * Get user display name
     */
    getUserDisplayName() {
        return this.user ? (this.user.displayName || this.user.email) : null;
    }

    /**
     * Get user photo URL
     */
    getUserPhotoURL() {
        return this.user ? this.user.photoURL : null;
    }
}

// Export singleton instance
const authManager = new AuthManager();

// Auto-initialize when DOM is ready (unless in test mode)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Only skip if test mode on localhost with flag set
        const urlParams = new URLSearchParams(window.location.search);
        const isTestMode = urlParams.get('test') === 'true';
        const isLocalhost = window.location.hostname === 'localhost' ||
                            window.location.hostname === '127.0.0.1';

        if (isTestMode && isLocalhost && window.SKIP_AUTH_INIT) {
            console.log('[AUTH] Skipping Firebase auth initialization (test mode on localhost)');
            return;
        } else if (isTestMode && !isLocalhost) {
            console.warn('[AUTH] Test mode parameter detected on production - IGNORING for security');
        }
        console.log('[AUTH] Auto-initializing Firebase auth');
        authManager.initialize().catch(console.error);
    });
} else {
    // Only skip if test mode on localhost with flag set
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('test') === 'true';
    const isLocalhost = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';

    if (isTestMode && isLocalhost && window.SKIP_AUTH_INIT) {
        console.log('[AUTH] Skipping Firebase auth initialization (test mode on localhost)');
    } else {
        if (isTestMode && !isLocalhost) {
            console.warn('[AUTH] Test mode parameter detected on production - IGNORING for security');
        }
        console.log('[AUTH] Auto-initializing Firebase auth (DOM already loaded)');
        authManager.initialize().catch(console.error);
    }
}
