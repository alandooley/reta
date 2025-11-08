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

        // Set persistence to LOCAL (persists across browser sessions)
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('Firebase auth persistence set to LOCAL');
        } catch (error) {
            console.error('Failed to set persistence:', error);
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
            // Show user-friendly error
            if (error.code === 'auth/popup-closed-by-user' ||
                error.code === 'auth/cancelled-popup-request' ||
                error.message.includes('missing initial state')) {
                console.log('Auth flow was interrupted or storage is unavailable. Please try signing in again.');
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
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();

            // Use popup for CloudFront domain to avoid redirect issues
            // Use redirect for Firebase hosting domains
            const isCloudFront = window.location.hostname.includes('cloudfront.net');

            if (isCloudFront) {
                console.log('Starting Google sign-in via popup (CloudFront domain)...');
                const result = await firebase.auth().signInWithPopup(provider);
                console.log('✅ Popup sign-in successful:', result.user.email);
            } else {
                console.log('Starting Google sign-in via redirect (Firebase hosting)...');
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
                throw new Error('Browser storage issue. Please enable cookies and try again.');
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
        // Only skip if BOTH test mode URL param AND flag are set
        const urlParams = new URLSearchParams(window.location.search);
        const isTestMode = urlParams.get('test') === 'true';

        if (isTestMode && window.SKIP_AUTH_INIT) {
            console.log('[AUTH] Skipping Firebase auth initialization (test mode)');
            return;
        }
        console.log('[AUTH] Auto-initializing Firebase auth');
        authManager.initialize().catch(console.error);
    });
} else {
    // Only skip if BOTH test mode URL param AND flag are set
    const urlParams = new URLSearchParams(window.location.search);
    const isTestMode = urlParams.get('test') === 'true';

    if (isTestMode && window.SKIP_AUTH_INIT) {
        console.log('[AUTH] Skipping Firebase auth initialization (test mode)');
    } else {
        console.log('[AUTH] Auto-initializing Firebase auth (DOM already loaded)');
        authManager.initialize().catch(console.error);
    }
}
