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
     * Sign in with Google
     */
    async signInWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);

            console.log('Signed in as:', result.user.email);

            // Get ID token
            await this.refreshIdToken();

            return result.user;
        } catch (error) {
            console.error('Sign in error:', error);
            throw new Error(`Sign in failed: ${error.message}`);
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
