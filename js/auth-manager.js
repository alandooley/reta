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

        // Use LOCAL persistence for 30-day login sessions
        // Since we now use popup mode exclusively (not redirect), LOCAL persistence works reliably
        // Combined with a 30-day expiry check, this gives users monthly login sessions
        try {
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('Firebase auth persistence set to LOCAL (30-day session enabled)');
        } catch (error) {
            console.error('Failed to set LOCAL persistence:', error);
            // Continue anyway - Firebase will use default persistence
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
            // Since we now use popup mode exclusively for sign-in, this error is expected
            // in these scenarios and can be safely ignored:
            // - Storage partitioning (Safari ITP, Chrome 3rd party cookie blocking)
            // - Stale redirect state from before popup mode migration
            // - Browser cleared sessionStorage between visits
            // User can still sign in normally via popup - no need to show an error
            if (error.message.includes('missing initial state')) {
                console.log('ℹ️ Ignoring "missing initial state" error - expected with popup-only auth mode');
                console.log('  (Stale redirect state or storage partitioning - user can sign in via popup)');
                // Clear any stale auth error from previous sessions
                try {
                    sessionStorage.removeItem('auth_error');
                } catch (e) {
                    // sessionStorage may be inaccessible - that's fine
                }
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
                // Check for 30-day session expiry
                const loginTimestamp = localStorage.getItem('auth_login_timestamp');
                const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

                if (loginTimestamp) {
                    const elapsed = Date.now() - parseInt(loginTimestamp, 10);
                    if (elapsed > THIRTY_DAYS_MS) {
                        console.log('Session expired (30+ days old). Signing out...');
                        localStorage.removeItem('auth_login_timestamp');
                        await this.signOut();
                        return;
                    }
                } else {
                    // First time seeing this user or timestamp missing - set it now
                    localStorage.setItem('auth_login_timestamp', Date.now().toString());
                    console.log('Login timestamp set for 30-day session tracking');
                }

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
     * Sign in with Google (uses popup mode to avoid Safari cross-origin storage issues)
     *
     * IMPORTANT: We use popup mode for all devices because:
     * 1. Safari 16.1+ blocks cross-origin iframe storage access
     * 2. signInWithRedirect() fails when authDomain (firebaseapp.com) differs from app domain (cloudfront.net)
     * 3. Firebase SDK loads cross-origin iframe during redirect return, which Safari blocks
     * 4. This causes "missing initial state" errors or silent auth failures on mobile
     *
     * Popup mode works on mobile because it doesn't require cross-origin storage access.
     * Proper fix would be: change authDomain to CloudFront domain + set up reverse proxy.
     *
     * @param {boolean} forcePopup - Kept for backwards compatibility (always uses popup now)
     */
    async signInWithGoogle(forcePopup = false) {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account'  // Always show account picker
            });

            // Detect mobile device (for logging purposes)
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            // Always use popup mode (redirect broken on Safari 16.1+ due to cross-origin storage blocking)
            console.log(isMobile ?
                'Starting Google sign-in via popup (mobile device, redirect disabled due to Safari issues)...' :
                'Starting Google sign-in via popup (desktop)...'
            );

            const result = await firebase.auth().signInWithPopup(provider);
            console.log('✅ Popup sign-in successful:', result.user.email);

            // Reset 30-day session timestamp on new sign-in
            localStorage.setItem('auth_login_timestamp', Date.now().toString());
            console.log('Login timestamp reset for new 30-day session');

        } catch (error) {
            console.error('Sign in error:', error);

            // Provide helpful error messages for common issues
            if (error.code === 'auth/popup-blocked') {
                throw new Error('Sign-in popup was blocked. Please allow popups and try again.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                throw new Error('Sign-in popup was closed. Please try again.');
            } else if (error.code === 'auth/operation-not-allowed') {
                throw new Error('Google sign-in is not enabled. Please contact support.');
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
            // Clear 30-day session timestamp on sign out
            localStorage.removeItem('auth_login_timestamp');
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
