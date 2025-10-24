/**
 * Migration Wizard
 * Handles one-time migration of CSV data to cloud
 */

class MigrationWizard {
    constructor() {
        this.apiClient = null;
        this.authManager = null;
        this.migrationData = null;
    }

    /**
     * Initialize migration wizard
     */
    initialize(authManager, apiClient) {
        this.authManager = authManager;
        this.apiClient = apiClient;
    }

    /**
     * Check if migration data exists
     */
    async checkForMigrationData() {
        try {
            const response = await fetch('./migration-data.json');
            if (response.ok) {
                this.migrationData = await response.json();
                return true;
            }
        } catch (error) {
            console.log('No migration data found');
        }
        return false;
    }

    /**
     * Show migration prompt
     */
    showMigrationPrompt() {
        const modalHTML = `
            <div id="migration-modal" class="modal" style="display: block;">
                <div class="modal-content">
                    <h2>📥 Migrate Your Data</h2>
                    <p>We found your historical tracking data ready to upload to the cloud!</p>

                    <div class="migration-summary">
                        <h3>Data Summary:</h3>
                        <ul>
                            <li><strong>${this.migrationData.injections.length}</strong> injections</li>
                            <li><strong>${this.migrationData.weights.length}</strong> weight entries</li>
                            <li><strong>${this.migrationData.vials.length}</strong> vials</li>
                        </ul>
                        <p class="date-range">
                            ${this.getDateRange()}
                        </p>
                    </div>

                    <div class="migration-actions">
                        <button id="migrate-now-btn" class="btn-primary">
                            🚀 Migrate Now
                        </button>
                        <button id="migrate-later-btn" class="btn-secondary">
                            ⏰ Remind Me Later
                        </button>
                        <button id="migrate-skip-btn" class="btn-text">
                            Skip (Don't ask again)
                        </button>
                    </div>

                    <div id="migration-progress" style="display: none;">
                        <div class="progress-bar">
                            <div id="migration-progress-fill" class="progress-fill"></div>
                        </div>
                        <p id="migration-status">Uploading data...</p>
                    </div>

                    <div id="migration-result" style="display: none;"></div>
                </div>
            </div>
        `;

        // Add modal to page
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = modalHTML;
        document.body.appendChild(modalDiv);

        // Add event listeners
        document.getElementById('migrate-now-btn').addEventListener('click', () => {
            this.runMigration();
        });

        document.getElementById('migrate-later-btn').addEventListener('click', () => {
            this.closeMigrationModal();
            localStorage.setItem('migration-remind-later', Date.now().toString());
        });

        document.getElementById('migrate-skip-btn').addEventListener('click', () => {
            this.closeMigrationModal();
            localStorage.setItem('migration-skipped', 'true');
        });
    }

    /**
     * Get date range from migration data
     */
    getDateRange() {
        if (!this.migrationData || !this.migrationData.injections.length) {
            return '';
        }

        const dates = this.migrationData.injections.map(i => new Date(i.timestamp));
        const earliest = new Date(Math.min(...dates));
        const latest = new Date(Math.max(...dates));

        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        };

        return `From ${formatDate(earliest)} to ${formatDate(latest)}`;
    }

    /**
     * Run the migration
     */
    async runMigration() {
        const progressDiv = document.getElementById('migration-progress');
        const actionsDiv = document.querySelector('.migration-actions');
        const statusEl = document.getElementById('migration-status');
        const progressFill = document.getElementById('migration-progress-fill');
        const resultDiv = document.getElementById('migration-result');

        // Show progress, hide actions
        actionsDiv.style.display = 'none';
        progressDiv.style.display = 'block';

        try {
            // Check authentication
            if (!this.authManager.isAuthenticated()) {
                throw new Error('Please sign in first');
            }

            // Update status
            statusEl.textContent = 'Preparing data...';
            progressFill.style.width = '20%';

            // Upload via sync API
            statusEl.textContent = 'Uploading to cloud...';
            progressFill.style.width = '50%';

            const result = await this.apiClient.syncData(this.migrationData);

            progressFill.style.width = '100%';
            statusEl.textContent = 'Migration complete!';

            // Show result
            setTimeout(() => {
                progressDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = `
                    <div class="migration-success">
                        <h3>✅ Migration Successful!</h3>
                        <div class="migration-stats">
                            <p>✓ ${result.results.injections.imported} injections uploaded</p>
                            <p>✓ ${result.results.vials.imported} vials uploaded</p>
                            <p>✓ ${result.results.weights.imported} weights uploaded</p>
                        </div>
                        <button id="migration-done-btn" class="btn-primary">Done</button>
                    </div>
                `;

                document.getElementById('migration-done-btn').addEventListener('click', () => {
                    this.closeMigrationModal();
                    localStorage.setItem('migration-completed', 'true');

                    // Refresh the page to load migrated data
                    window.location.reload();
                });
            }, 1000);

        } catch (error) {
            console.error('Migration failed:', error);

            progressDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = `
                <div class="migration-error">
                    <h3>❌ Migration Failed</h3>
                    <p>${error.message}</p>
                    <button id="migration-retry-btn" class="btn-primary">Retry</button>
                    <button id="migration-cancel-btn" class="btn-secondary">Cancel</button>
                </div>
            `;

            document.getElementById('migration-retry-btn').addEventListener('click', () => {
                resultDiv.style.display = 'none';
                actionsDiv.style.display = 'block';
            });

            document.getElementById('migration-cancel-btn').addEventListener('click', () => {
                this.closeMigrationModal();
            });
        }
    }

    /**
     * Close migration modal
     */
    closeMigrationModal() {
        const modal = document.getElementById('migration-modal');
        if (modal) {
            modal.parentElement.remove();
        }
    }

    /**
     * Check if should show migration prompt
     */
    shouldShowMigrationPrompt() {
        // Don't show if already completed
        if (localStorage.getItem('migration-completed') === 'true') {
            return false;
        }

        // Don't show if user skipped
        if (localStorage.getItem('migration-skipped') === 'true') {
            return false;
        }

        // Check if "remind later" is still active (24 hours)
        const remindLater = localStorage.getItem('migration-remind-later');
        if (remindLater) {
            const remindTime = parseInt(remindLater);
            const now = Date.now();
            const hoursSinceReminder = (now - remindTime) / (1000 * 60 * 60);

            if (hoursSinceReminder < 24) {
                return false;
            }
        }

        return true;
    }

    /**
     * Auto-start migration wizard if conditions are met
     */
    async autoStart() {
        // Check for migration data
        const hasMigrationData = await this.checkForMigrationData();

        if (!hasMigrationData) {
            console.log('No migration data found');
            return;
        }

        // Check if authManager is initialized
        if (!this.authManager) {
            console.log('AuthManager not initialized, skipping migration prompt');
            return;
        }

        // Check if user is authenticated
        if (!this.authManager.isAuthenticated()) {
            console.log('Not authenticated, skipping migration prompt');
            return;
        }

        // Check if should show prompt
        if (!this.shouldShowMigrationPrompt()) {
            console.log('Migration prompt not needed');
            return;
        }

        // Show migration prompt
        console.log('Showing migration prompt');
        this.showMigrationPrompt();
    }
}

// Export singleton instance
const migrationWizard = new MigrationWizard();
