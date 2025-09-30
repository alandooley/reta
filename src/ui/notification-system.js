/**
 * Notification System
 * Toast notifications and visual feedback for user actions
 */

import logger from '../utils/logger.js';

/**
 * Notification types
 */
export const NotificationType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  SAVING: 'saving'
};

/**
 * Notification Manager Class
 */
class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.autoHideDelay = 3000; // 3 seconds
    this.initialized = false;
  }

  /**
   * Initialize the notification system
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    // Create container if it doesn't exist
    this.container = document.getElementById('notification-container');

    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }

    // Add styles
    this.injectStyles();

    this.initialized = true;
    logger.info('Notification system initialized');
  }

  /**
   * Inject notification styles
   * @private
   */
  injectStyles() {
    if (document.getElementById('notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification-container {
        position: fixed;
        top: 80px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 400px;
        pointer-events: none;
      }

      .notification {
        background: #1a1a1a;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideIn 0.3s ease-out;
        pointer-events: auto;
        border-left: 4px solid;
        min-width: 300px;
      }

      .notification.success {
        border-left-color: #34C759;
      }

      .notification.error {
        border-left-color: #FF3B30;
      }

      .notification.warning {
        border-left-color: #FF9500;
      }

      .notification.info {
        border-left-color: #007AFF;
      }

      .notification.saving {
        border-left-color: #5AC8FA;
      }

      .notification-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .notification-content {
        flex: 1;
        color: #ffffff;
      }

      .notification-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
      }

      .notification-message {
        font-size: 13px;
        color: #cccccc;
        line-height: 1.4;
      }

      .notification-close {
        background: none;
        border: none;
        color: #888888;
        cursor: pointer;
        font-size: 20px;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .notification-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      .notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 0 0 12px 12px;
        overflow: hidden;
      }

      .notification-progress-bar {
        height: 100%;
        background: currentColor;
        animation: progress linear;
        transform-origin: left;
      }

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

      @keyframes progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }

      .notification.hiding {
        animation: slideOut 0.3s ease-in forwards;
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .notification-container {
          left: 20px;
          right: 20px;
          top: 70px;
          max-width: none;
        }

        .notification {
          min-width: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Get icon for notification type
   * @param {string} type - Notification type
   * @returns {string} Icon emoji
   * @private
   */
  getIcon(type) {
    const icons = {
      [NotificationType.SUCCESS]: '✓',
      [NotificationType.ERROR]: '✕',
      [NotificationType.WARNING]: '⚠',
      [NotificationType.INFO]: 'ℹ',
      [NotificationType.SAVING]: '⋯'
    };
    return icons[type] || 'ℹ';
  }

  /**
   * Get title for notification type
   * @param {string} type - Notification type
   * @returns {string} Default title
   * @private
   */
  getDefaultTitle(type) {
    const titles = {
      [NotificationType.SUCCESS]: 'Success',
      [NotificationType.ERROR]: 'Error',
      [NotificationType.WARNING]: 'Warning',
      [NotificationType.INFO]: 'Info',
      [NotificationType.SAVING]: 'Saving...'
    };
    return titles[type] || 'Notification';
  }

  /**
   * Show a notification
   * @param {string} type - Notification type
   * @param {string} message - Notification message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  show(type, message, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    const id = options.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const title = options.title || this.getDefaultTitle(type);
    const duration = options.duration !== undefined ? options.duration : this.autoHideDelay;
    const dismissible = options.dismissible !== false;

    // If notification with this ID exists, update it instead
    if (this.notifications.has(id)) {
      this.update(id, { type, title, message, duration });
      return id;
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;

    notification.innerHTML = `
      <div class="notification-icon">${this.getIcon(type)}</div>
      <div class="notification-content">
        <div class="notification-title">${this.escapeHtml(title)}</div>
        <div class="notification-message">${this.escapeHtml(message)}</div>
      </div>
      ${dismissible ? '<button class="notification-close" aria-label="Close">×</button>' : ''}
      ${duration > 0 ? '<div class="notification-progress"><div class="notification-progress-bar"></div></div>' : ''}
    `;

    // Add to container
    this.container.appendChild(notification);

    // Store reference
    this.notifications.set(id, {
      element: notification,
      type,
      title,
      message,
      timer: null
    });

    // Setup close button
    if (dismissible) {
      const closeBtn = notification.querySelector('.notification-close');
      closeBtn.addEventListener('click', () => this.hide(id));
    }

    // Setup auto-hide
    if (duration > 0) {
      const progressBar = notification.querySelector('.notification-progress-bar');
      if (progressBar) {
        progressBar.style.animationDuration = `${duration}ms`;
      }

      const timer = setTimeout(() => this.hide(id), duration);
      this.notifications.get(id).timer = timer;
    }

    logger.debug('Notification shown', { id, type, message });

    return id;
  }

  /**
   * Update an existing notification
   * @param {string} id - Notification ID
   * @param {Object} updates - Properties to update
   */
  update(id, updates) {
    const notification = this.notifications.get(id);
    if (!notification) {
      logger.warn('Notification not found for update', { id });
      return;
    }

    const { element } = notification;

    // Update type
    if (updates.type) {
      element.className = `notification ${updates.type}`;
      const icon = element.querySelector('.notification-icon');
      if (icon) {
        icon.textContent = this.getIcon(updates.type);
      }
      notification.type = updates.type;
    }

    // Update title
    if (updates.title) {
      const titleEl = element.querySelector('.notification-title');
      if (titleEl) {
        titleEl.textContent = updates.title;
      }
      notification.title = updates.title;
    }

    // Update message
    if (updates.message) {
      const messageEl = element.querySelector('.notification-message');
      if (messageEl) {
        messageEl.textContent = updates.message;
      }
      notification.message = updates.message;
    }

    // Update duration
    if (updates.duration !== undefined) {
      // Clear old timer
      if (notification.timer) {
        clearTimeout(notification.timer);
      }

      // Set new timer
      if (updates.duration > 0) {
        const progressBar = element.querySelector('.notification-progress-bar');
        if (progressBar) {
          progressBar.style.animation = 'none';
          // Force reflow
          void progressBar.offsetWidth;
          progressBar.style.animation = null;
          progressBar.style.animationDuration = `${updates.duration}ms`;
        }

        notification.timer = setTimeout(() => this.hide(id), updates.duration);
      }
    }

    logger.debug('Notification updated', { id, updates });
  }

  /**
   * Hide a notification
   * @param {string} id - Notification ID
   */
  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) {
      return;
    }

    const { element, timer } = notification;

    // Clear timer
    if (timer) {
      clearTimeout(timer);
    }

    // Animate out
    element.classList.add('hiding');

    // Remove after animation
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.delete(id);
      logger.debug('Notification hidden', { id });
    }, 300);
  }

  /**
   * Hide all notifications
   */
  hideAll() {
    this.notifications.forEach((_, id) => this.hide(id));
  }

  /**
   * Show success notification
   * @param {string} message - Success message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  success(message, options = {}) {
    return this.show(NotificationType.SUCCESS, message, options);
  }

  /**
   * Show error notification
   * @param {string} message - Error message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  error(message, options = {}) {
    return this.show(NotificationType.ERROR, message, {
      duration: 5000, // Errors stay longer
      ...options
    });
  }

  /**
   * Show warning notification
   * @param {string} message - Warning message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  warning(message, options = {}) {
    return this.show(NotificationType.WARNING, message, options);
  }

  /**
   * Show info notification
   * @param {string} message - Info message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  info(message, options = {}) {
    return this.show(NotificationType.INFO, message, options);
  }

  /**
   * Show saving notification (persistent until updated)
   * @param {string} message - Saving message
   * @param {Object} options - Additional options
   * @returns {string} Notification ID
   */
  saving(message = 'Saving...', options = {}) {
    return this.show(NotificationType.SAVING, message, {
      duration: 0, // Don't auto-hide
      dismissible: false,
      id: options.id || 'saving',
      ...options
    });
  }

  /**
   * Convert saving notification to success
   * @param {string} id - Notification ID
   * @param {string} message - Success message
   */
  savingComplete(id = 'saving', message = 'Saved successfully') {
    this.update(id, {
      type: NotificationType.SUCCESS,
      title: 'Saved',
      message: message,
      duration: 2000
    });
  }

  /**
   * Convert saving notification to error
   * @param {string} id - Notification ID
   * @param {string} message - Error message
   */
  savingFailed(id = 'saving', message = 'Failed to save') {
    this.update(id, {
      type: NotificationType.ERROR,
      title: 'Save Failed',
      message: message,
      duration: 5000
    });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   * @private
   */
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Create singleton instance
const notificationManager = new NotificationManager();

export default notificationManager;
export { NotificationManager };