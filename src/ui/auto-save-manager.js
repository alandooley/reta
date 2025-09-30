/**
 * Auto-Save Manager
 * Handles automatic saving of form fields with debouncing and user feedback
 */

import notificationManager from './notification-system.js';
import resilientStorage from '../core/resilient-storage.js';
import logger from '../utils/logger.js';
import { debounce } from '../utils/utils.js';

/**
 * Auto-Save Manager Class
 */
class AutoSaveManager {
  constructor() {
    this.savingFields = new Set();
    this.saveTimers = new Map();
    this.defaultDebounceDelay = 1000; // 1 second
    this.initialized = false;
  }

  /**
   * Initialize auto-save manager
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    // Initialize notification system
    notificationManager.initialize();

    this.initialized = true;
    logger.info('AutoSave manager initialized');
  }

  /**
   * Enable auto-save for an input field
   * @param {HTMLElement} element - Input element
   * @param {Object} options - Configuration options
   */
  enableAutoSave(element, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    const {
      dataPath = element.name || element.id,
      debounceDelay = this.defaultDebounceDelay,
      transform = null,
      validate = null,
      onSave = null,
      showNotification = true,
      fieldLabel = element.placeholder || element.name || 'Field'
    } = options;

    if (!dataPath) {
      logger.error('Auto-save requires dataPath, name, or id on element');
      return;
    }

    // Create debounced save function
    const debouncedSave = debounce(async (value) => {
      await this.saveField(element, dataPath, value, {
        transform,
        validate,
        onSave,
        showNotification,
        fieldLabel
      });
    }, debounceDelay);

    // Add event listener
    const handleInput = (e) => {
      const value = e.target.value;

      // Show saving indicator
      this.showSavingIndicator(element, fieldLabel);

      // Trigger debounced save
      debouncedSave(value);
    };

    element.addEventListener('input', handleInput);
    element.addEventListener('change', handleInput);

    // Store reference for cleanup
    element.dataset.autoSaveEnabled = 'true';
    element.dataset.autoSavePath = dataPath;

    logger.debug('Auto-save enabled', { dataPath, debounceDelay });
  }

  /**
   * Save a field value
   * @param {HTMLElement} element - Input element
   * @param {string} dataPath - Path in data object
   * @param {*} value - Value to save
   * @param {Object} options - Save options
   * @private
   */
  async saveField(element, dataPath, value, options = {}) {
    const { transform, validate, onSave, showNotification, fieldLabel } = options;

    try {
      // Mark as saving
      this.savingFields.add(dataPath);

      // Transform value if function provided
      let transformedValue = value;
      if (transform && typeof transform === 'function') {
        transformedValue = transform(value);
      }

      // Validate if function provided
      if (validate && typeof validate === 'function') {
        const validationResult = validate(transformedValue);
        if (validationResult !== true) {
          throw new Error(validationResult || 'Validation failed');
        }
      }

      // Load current data
      const data = await resilientStorage.loadData();

      // Create nested structure if needed
      const pathParts = dataPath.split('.');
      let current = data;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part] || typeof current[part] !== 'object') {
          current[part] = {};
        }
        current = current[part];
      }

      // Set the value
      const lastPart = pathParts[pathParts.length - 1];
      current[lastPart] = transformedValue;

      // Save to storage
      await resilientStorage.saveData(data);

      // Call custom onSave if provided
      if (onSave && typeof onSave === 'function') {
        await onSave(transformedValue, data);
      }

      // Show success indicator
      this.showSaveSuccess(element, fieldLabel, showNotification);

      logger.info('Field saved', { dataPath, value: transformedValue });

    } catch (error) {
      // Show error indicator
      this.showSaveError(element, fieldLabel, error.message, showNotification);

      logger.error('Field save failed', {
        dataPath,
        error: error.message
      });
    } finally {
      // Mark as no longer saving
      this.savingFields.delete(dataPath);
    }
  }

  /**
   * Show saving indicator on field
   * @param {HTMLElement} element - Input element
   * @param {string} fieldLabel - Field label
   * @private
   */
  showSavingIndicator(element, fieldLabel) {
    // Add visual indicator to field
    element.classList.add('saving');

    // Update or create status element
    let status = element.parentElement.querySelector('.save-status');
    if (!status) {
      status = document.createElement('span');
      status.className = 'save-status';
      element.parentElement.style.position = 'relative';
      element.parentElement.appendChild(status);
    }

    status.className = 'save-status saving';
    status.textContent = '⋯ Saving...';
    status.style.display = 'inline-block';
  }

  /**
   * Show save success indicator
   * @param {HTMLElement} element - Input element
   * @param {string} fieldLabel - Field label
   * @param {boolean} showNotification - Whether to show toast
   * @private
   */
  showSaveSuccess(element, fieldLabel, showNotification) {
    // Remove saving class
    element.classList.remove('saving');
    element.classList.add('saved');

    // Update status element
    const status = element.parentElement.querySelector('.save-status');
    if (status) {
      status.className = 'save-status saved';
      status.textContent = '✓ Saved';

      // Hide after 2 seconds
      setTimeout(() => {
        status.style.display = 'none';
        element.classList.remove('saved');
      }, 2000);
    }

    // Show toast notification if enabled
    if (showNotification) {
      notificationManager.success(`${fieldLabel} saved`, {
        duration: 2000
      });
    }
  }

  /**
   * Show save error indicator
   * @param {HTMLElement} element - Input element
   * @param {string} fieldLabel - Field label
   * @param {string} errorMessage - Error message
   * @param {boolean} showNotification - Whether to show toast
   * @private
   */
  showSaveError(element, fieldLabel, errorMessage, showNotification) {
    // Remove saving class, add error class
    element.classList.remove('saving');
    element.classList.add('save-error');

    // Update status element
    const status = element.parentElement.querySelector('.save-status');
    if (status) {
      status.className = 'save-status error';
      status.textContent = '✕ Failed';

      // Hide after 3 seconds
      setTimeout(() => {
        status.style.display = 'none';
        element.classList.remove('save-error');
      }, 3000);
    }

    // Show toast notification if enabled
    if (showNotification) {
      notificationManager.error(`Failed to save ${fieldLabel}: ${errorMessage}`, {
        duration: 4000
      });
    }
  }

  /**
   * Enable auto-save for multiple fields
   * @param {string} selector - CSS selector for fields
   * @param {Object} options - Configuration options
   */
  enableAutoSaveForAll(selector, options = {}) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      this.enableAutoSave(element, options);
    });

    logger.info('Auto-save enabled for multiple fields', {
      count: elements.length,
      selector
    });
  }

  /**
   * Disable auto-save for a field
   * @param {HTMLElement} element - Input element
   */
  disableAutoSave(element) {
    if (element.dataset.autoSaveEnabled !== 'true') {
      return;
    }

    // Remove event listeners by cloning element
    const newElement = element.cloneNode(true);
    element.parentNode.replaceChild(newElement, element);

    delete newElement.dataset.autoSaveEnabled;
    delete newElement.dataset.autoSavePath;

    logger.debug('Auto-save disabled for element');
  }

  /**
   * Check if any fields are currently saving
   * @returns {boolean} True if saving
   */
  isSaving() {
    return this.savingFields.size > 0;
  }

  /**
   * Get list of fields currently saving
   * @returns {Array<string>} Array of field paths
   */
  getSavingFields() {
    return Array.from(this.savingFields);
  }

  /**
   * Inject auto-save styles
   */
  injectStyles() {
    if (document.getElementById('autosave-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'autosave-styles';
    style.textContent = `
      /* Auto-save field states */
      input.saving,
      textarea.saving,
      select.saving {
        border-color: #5AC8FA !important;
        animation: pulse 1.5s infinite;
      }

      input.saved,
      textarea.saved,
      select.saved {
        border-color: #34C759 !important;
      }

      input.save-error,
      textarea.save-error,
      select.save-error {
        border-color: #FF3B30 !important;
      }

      @keyframes pulse {
        0%, 100% {
          border-color: #5AC8FA;
        }
        50% {
          border-color: #007AFF;
        }
      }

      /* Save status indicator */
      .save-status {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        pointer-events: none;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 500;
      }

      .save-status.saving {
        color: #5AC8FA;
      }

      .save-status.saved {
        color: #34C759;
      }

      .save-status.error {
        color: #FF3B30;
        background: rgba(255, 59, 48, 0.1);
      }
    `;
    document.head.appendChild(style);
  }
}

// Create singleton instance
const autoSaveManager = new AutoSaveManager();

// Inject styles when module loads
autoSaveManager.injectStyles();

export default autoSaveManager;
export { AutoSaveManager };