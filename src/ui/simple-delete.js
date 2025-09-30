/**
 * Simple Delete Component
 * Works perfectly on desktop and mobile with visible delete buttons
 */

import deleteManager from '../managers/delete-manager.js';
import resilientStorage from '../core/resilient-storage.js';
import notificationManager from './notification-system.js';
import logger from '../utils/logger.js';

/**
 * Simple Delete Manager
 */
class SimpleDeleteManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the delete system
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.injectStyles();
    notificationManager.initialize();
    this.initialized = true;

    logger.info('Simple delete initialized');
  }

  /**
   * Enable delete buttons on items
   * @param {string} containerSelector - Selector for item containers
   * @param {Object} options - Configuration options
   */
  enableDelete(containerSelector, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    const {
      itemType = 'injection',
      onDelete = null,
      confirmDelete = true,
      showUndo = true,
      itemIdAttribute = 'data-id'
    } = options;

    const containers = document.querySelectorAll(containerSelector);

    containers.forEach(container => {
      const deleteBtn = container.querySelector('.delete-btn');

      if (!deleteBtn) {
        logger.warn('No .delete-btn found in container', { container });
        return;
      }

      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        e.preventDefault();

        const itemId = container.getAttribute(itemIdAttribute);
        const timestamp = container.getAttribute('data-timestamp');

        await this.handleDelete(container, itemId, timestamp, {
          itemType,
          onDelete,
          confirmDelete,
          showUndo
        });
      };
    });

    logger.debug('Delete enabled for items', {
      count: containers.length,
      itemType
    });
  }

  /**
   * Handle delete action
   * @param {HTMLElement} container - Container element
   * @param {string} itemId - Item ID
   * @param {string} timestamp - Timestamp for weights
   * @param {Object} options - Configuration
   * @private
   */
  async handleDelete(container, itemId, timestamp, options) {
    const {
      itemType,
      onDelete,
      confirmDelete,
      showUndo
    } = options;

    // Confirm if enabled
    if (confirmDelete) {
      const confirmed = confirm(`Delete this ${itemType}?`);
      if (!confirmed) {
        return;
      }
    }

    // Disable button during delete
    const deleteBtn = container.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Deleting...';
    }

    try {
      const data = await resilientStorage.loadData();
      let result;

      // Delete based on type
      switch (itemType) {
        case 'injection':
          result = deleteManager.deleteInjection(data.injections, itemId);
          data.injections = result.injections;
          break;

        case 'vial':
          try {
            result = deleteManager.deleteVial(data.vials, itemId, data.injections);
            data.vials = result.vials;
          } catch (error) {
            // Handle vial with references
            if (error.message.includes('injection(s) reference')) {
              const confirmForce = confirm(
                error.message + '\n\nDelete vial AND all related injections?'
              );
              if (confirmForce) {
                result = deleteManager.forceDeleteVial(data.vials, data.injections, itemId);
                data.vials = result.vials;
                data.injections = result.injections;
              } else {
                if (deleteBtn) {
                  deleteBtn.disabled = false;
                  deleteBtn.textContent = '🗑️ Delete';
                }
                return;
              }
            } else {
              throw error;
            }
          }
          break;

        case 'weight':
          result = deleteManager.deleteWeight(data.weights, timestamp);
          data.weights = result.weights;
          break;

        default:
          throw new Error('Unknown item type: ' + itemType);
      }

      // Save
      await resilientStorage.saveData(data);

      // Animate out
      container.style.transition = 'all 0.3s ease';
      container.style.opacity = '0';
      container.style.transform = 'translateX(-20px)';
      container.style.maxHeight = container.offsetHeight + 'px';

      setTimeout(() => {
        container.style.maxHeight = '0';
        container.style.marginTop = '0';
        container.style.marginBottom = '0';
        container.style.paddingTop = '0';
        container.style.paddingBottom = '0';
      }, 150);

      setTimeout(() => {
        container.remove();
      }, 450);

      // Show notification
      notificationManager.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted`, {
        duration: 2000
      });

      // Show undo option
      if (showUndo) {
        this.showUndoButton();
      }

      // Call custom handler
      if (onDelete && typeof onDelete === 'function') {
        onDelete(itemId, result);
      }

      logger.info('Item deleted', { itemType, itemId });

    } catch (error) {
      logger.error('Delete failed', { error: error.message });
      notificationManager.error('Failed to delete: ' + error.message);

      // Reset button on error
      if (deleteBtn) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ Delete';
      }
    }
  }

  /**
   * Show undo button
   * @private
   */
  showUndoButton() {
    if (!deleteManager.canUndo()) {
      return;
    }

    let undoBtn = document.getElementById('simple-delete-undo-btn');

    if (!undoBtn) {
      undoBtn = document.createElement('button');
      undoBtn.id = 'simple-delete-undo-btn';
      undoBtn.className = 'simple-delete-undo-btn';
      undoBtn.innerHTML = '↩️ Undo';
      document.body.appendChild(undoBtn);

      undoBtn.onclick = async () => {
        try {
          undoBtn.disabled = true;
          undoBtn.textContent = 'Undoing...';

          const data = await resilientStorage.loadData();
          const restored = deleteManager.undoLastDelete(data);
          await resilientStorage.saveData(restored);

          notificationManager.success('Delete undone!');

          // Reload page to show restored item
          setTimeout(() => location.reload(), 500);

        } catch (error) {
          notificationManager.error('Failed to undo: ' + error.message);
          undoBtn.disabled = false;
          undoBtn.textContent = '↩️ Undo';
        }
      };
    }

    undoBtn.style.display = 'flex';

    // Hide after 10 seconds
    setTimeout(() => {
      if (!deleteManager.canUndo()) {
        undoBtn.style.display = 'none';
      }
    }, 10000);
  }

  /**
   * Inject styles
   * @private
   */
  injectStyles() {
    if (document.getElementById('simple-delete-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'simple-delete-styles';
    style.textContent = `
      /* Delete item container */
      .delete-item-container {
        position: relative;
        overflow: hidden;
        margin-bottom: 8px;
        border-radius: 12px;
        background: var(--card-bg, #2a2a2a);
      }

      /* Delete button */
      .delete-btn {
        background: #FF3B30;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .delete-btn:hover {
        background: #ff5349;
        transform: scale(1.05);
      }

      .delete-btn:active {
        transform: scale(0.95);
      }

      .delete-btn:disabled {
        background: #666;
        cursor: not-allowed;
        transform: none;
      }

      /* Small delete button variant */
      .delete-btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }

      /* Icon only delete button */
      .delete-btn-icon {
        width: 36px;
        height: 36px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-size: 18px;
      }

      /* Undo button */
      .simple-delete-undo-btn {
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: var(--accent-color, #007AFF);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideUp 0.3s ease-out;
        display: none;
        align-items: center;
        gap: 8px;
      }

      .simple-delete-undo-btn:hover {
        transform: scale(1.05);
      }

      .simple-delete-undo-btn:active {
        transform: scale(0.95);
      }

      .simple-delete-undo-btn:disabled {
        background: #666;
        cursor: not-allowed;
        transform: none;
      }

      @keyframes slideUp {
        from {
          transform: translateY(100px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Mobile responsive */
      @media (max-width: 768px) {
        .simple-delete-undo-btn {
          bottom: 20px;
          right: 20px;
          left: 20px;
          width: auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create delete item HTML (helper)
   * @param {Object} content - Content configuration
   * @returns {string} HTML string
   */
  static createDeleteItem(content) {
    const {
      id,
      html,
      timestamp,
      buttonText = '🗑️ Delete',
      buttonSize = 'normal' // 'normal', 'sm', 'icon'
    } = content;

    const dataAttrs = timestamp
      ? `data-id="${id}" data-timestamp="${timestamp}"`
      : `data-id="${id}"`;

    const buttonClass = buttonSize === 'sm'
      ? 'delete-btn delete-btn-sm'
      : buttonSize === 'icon'
      ? 'delete-btn delete-btn-icon'
      : 'delete-btn';

    return `
      <div class="delete-item-container" ${dataAttrs}>
        ${html}
      </div>
    `;
  }
}

// Create singleton instance
const simpleDeleteManager = new SimpleDeleteManager();

export default simpleDeleteManager;
export { SimpleDeleteManager };