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

        // Check for redirect result first (for mobile/Safari compatibility)
        try {
            const result = await firebase.auth().getRedirectResult();
            if (result.user) {
                console.log('Sign-in completed via redirect:', result.user.email);
                // Auth state listener will handle the rest
            }
        } catch (error) {
            console.error('Redirect result error:', error);
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

            // Use redirect instead of popup for better mobile/Safari support
            // This works around storage partitioning and third-party cookie issues
            console.log('Starting Google sign-in redirect...');
            await firebase.auth().signInWithRedirect(provider);

            // Note: After redirect, the page will reload and initialize()
            // will call getRedirectResult() to complete the sign-in
        } catch (error) {
            console.error('Sign in error:', error);

            // Provide helpful error messages for common issues
            if (error.code === 'auth/popup-blocked') {
                throw new Error('Sign-in popup was blocked. Please allow popups and try again.');
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

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        authManager.initialize().catch(console.error);
    });
} else {
    authManager.initialize().catch(console.error);
}
