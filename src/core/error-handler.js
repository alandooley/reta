/**
 * Global Error Handler and Error Boundary
 * Provides centralized error handling, logging, and user-friendly error messages
 */

import logger from '../utils/logger.js';

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.severity = options.severity || ErrorSeverity.MEDIUM;
    this.userMessage = options.userMessage || message;
    this.code = options.code || 'UNKNOWN_ERROR';
    this.metadata = options.metadata || {};
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error Handler Class
 */
class ErrorHandler {
  constructor() {
    this.errorListeners = [];
    this.errorHistory = [];
    this.maxHistorySize = 100;
    this.initialized = false;
  }

  /**
   * Initialize global error handlers
   */
  initialize() {
    if (this.initialized) {
      logger.warn('ErrorHandler already initialized');
      return;
    }

    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        severity: ErrorSeverity.HIGH,
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          severity: ErrorSeverity.HIGH,
          metadata: { type: 'unhandledRejection' }
        }
      );
    });

    this.initialized = true;
    logger.info('ErrorHandler initialized');
  }

  /**
   * Handle an error with logging and user notification
   * @param {Error} error - Error object
   * @param {Object} options - Error handling options
   * @param {string} options.severity - Error severity level
   * @param {string} options.userMessage - User-friendly message
   * @param {Object} options.metadata - Additional metadata
   * @param {boolean} options.showNotification - Whether to show user notification
   */
  handleError(error, options = {}) {
    const severity = options.severity || ErrorSeverity.MEDIUM;
    const userMessage = options.userMessage || this.getUserFriendlyMessage(error);
    const metadata = options.metadata || {};
    const showNotification = options.showNotification !== false;

    // Create error record
    const errorRecord = {
      timestamp: new Date().toISOString(),
      error: error,
      message: error.message,
      stack: error.stack,
      severity: severity,
      userMessage: userMessage,
      metadata: metadata
    };

    // Store in history
    this.errorHistory.push(errorRecord);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Log based on severity
    switch (severity) {
      case ErrorSeverity.LOW:
        logger.info('Error handled', errorRecord);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn('Error handled', errorRecord);
        break;
      case ErrorSeverity.HIGH:
        logger.error('Error handled', errorRecord);
        break;
      case ErrorSeverity.CRITICAL:
        logger.fatal('Critical error handled', errorRecord);
        break;
    }

    // Notify error listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(errorRecord);
      } catch (err) {
        logger.error('Error in error listener', { error: err.message });
      }
    });

    // Show user notification if requested
    if (showNotification && severity !== ErrorSeverity.LOW) {
      this.showErrorNotification(userMessage, severity);
    }

    return errorRecord;
  }

  /**
   * Get user-friendly error message
   * @param {Error} error - Error object
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(error) {
    if (!error) {
      return 'An unknown error occurred. Please try again.';
    }

    // Map common error types to user-friendly messages
    const errorMappings = {
      'NetworkError': 'Network connection failed. Please check your internet connection.',
      'QuotaExceededError': 'Storage limit exceeded. Please free up some space.',
      'TypeError': 'An unexpected error occurred. Please refresh the page.',
      'ReferenceError': 'An unexpected error occurred. Please refresh the page.',
      'SyntaxError': 'An unexpected error occurred. Please refresh the page.',
      'Failed to fetch': 'Network request failed. Please check your connection.',
      'Storage failed': 'Failed to save data. Your browser storage may be full.',
      'Load failed': 'Failed to load data. Please refresh the page.'
    };

    // Check if error message matches any known patterns
    for (const [pattern, message] of Object.entries(errorMappings)) {
      if (error.name === pattern || error.message?.includes(pattern)) {
        return message;
      }
    }

    // Use custom user message if available
    if (error.userMessage) {
      return error.userMessage;
    }

    // Default message
    return 'An error occurred. Please try again or contact support if the problem persists.';
  }

  /**
   * Show error notification to user
   * @param {string} message - Error message
   * @param {string} severity - Error severity
   */
  showErrorNotification(message, severity) {
    // Try to find notification container
    let container = document.getElementById('error-notification-container');

    if (!container) {
      // Create container if it doesn't exist
      container = document.createElement('div');
      container.id = 'error-notification-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `error-notification severity-${severity}`;
    notification.style.cssText = `
      background: ${this.getSeverityColor(severity)};
      color: white;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 10px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      animation: slideIn 0.3s ease-out;
    `;

    notification.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1; padding-right: 10px;">
          <strong style="display: block; margin-bottom: 5px;">
            ${this.getSeverityLabel(severity)}
          </strong>
          <div>${this.escapeHtml(message)}</div>
        </div>
        <button onclick="this.parentElement.parentElement.remove()"
                style="background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0;">
          ×
        </button>
      </div>
    `;

    container.appendChild(notification);

    // Auto-remove after delay
    const delay = severity === ErrorSeverity.CRITICAL ? 10000 : 5000;
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
      }
    }, delay);
  }

  /**
   * Get color for severity level
   * @param {string} severity - Severity level
   * @returns {string} CSS color
   */
  getSeverityColor(severity) {
    const colors = {
      [ErrorSeverity.LOW]: '#4CAF50',
      [ErrorSeverity.MEDIUM]: '#FF9800',
      [ErrorSeverity.HIGH]: '#F44336',
      [ErrorSeverity.CRITICAL]: '#D32F2F'
    };
    return colors[severity] || colors[ErrorSeverity.MEDIUM];
  }

  /**
   * Get label for severity level
   * @param {string} severity - Severity level
   * @returns {string} Label
   */
  getSeverityLabel(severity) {
    const labels = {
      [ErrorSeverity.LOW]: 'Notice',
      [ErrorSeverity.MEDIUM]: 'Warning',
      [ErrorSeverity.HIGH]: 'Error',
      [ErrorSeverity.CRITICAL]: 'Critical Error'
    };
    return labels[severity] || labels[ErrorSeverity.MEDIUM];
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Add error listener
   * @param {Function} listener - Error listener function
   */
  addErrorListener(listener) {
    if (typeof listener === 'function') {
      this.errorListeners.push(listener);
    }
  }

  /**
   * Remove error listener
   * @param {Function} listener - Error listener function
   */
  removeErrorListener(listener) {
    const index = this.errorListeners.indexOf(listener);
    if (index > -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Get error history
   * @returns {Array} Error history
   */
  getErrorHistory() {
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  clearErrorHistory() {
    this.errorHistory = [];
    logger.info('Error history cleared');
  }

  /**
   * Wrap async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  wrapAsync(fn, options = {}) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, options);
        throw error;
      }
    };
  }

  /**
   * Wrap sync function with error handling
   * @param {Function} fn - Function to wrap
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function
   */
  wrap(fn, options = {}) {
    return (...args) => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, options);
        throw error;
      }
    };
  }
}

// Add CSS animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Create singleton instance
const errorHandler = new ErrorHandler();

export default errorHandler;
export { ErrorHandler };