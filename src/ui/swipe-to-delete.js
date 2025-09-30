/**
 * Swipe to Delete Component
 * Mobile-friendly swipe gesture for deleting items
 */

import deleteManager from '../managers/delete-manager.js';
import resilientStorage from '../core/resilient-storage.js';
import notificationManager from './notification-system.js';
import logger from '../utils/logger.js';

/**
 * Swipe to Delete Manager
 */
class SwipeToDeleteManager {
  constructor() {
    this.activeSwipes = new Map();
    this.swipeThreshold = 80; // pixels
    this.deleteThreshold = 120; // pixels to trigger auto-delete
    this.initialized = false;
  }

  /**
   * Initialize the swipe system
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    this.injectStyles();
    this.initialized = true;

    logger.info('Swipe to delete initialized');
  }

  /**
   * Enable swipe-to-delete on container elements
   * @param {string} containerSelector - Selector for item containers
   * @param {Object} options - Configuration options
   */
  enableSwipeToDelete(containerSelector, options = {}) {
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
      this.setupSwipeHandlers(container, {
        itemType,
        onDelete,
        confirmDelete,
        showUndo,
        itemIdAttribute
      });
    });

    logger.debug('Swipe enabled for items', {
      count: containers.length,
      itemType
    });
  }

  /**
   * Setup swipe handlers for a container
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration
   * @private
   */
  setupSwipeHandlers(container, options) {
    const content = container.querySelector('.swipe-content');
    const deleteAction = container.querySelector('.swipe-delete-action');

    if (!content || !deleteAction) {
      logger.warn('Missing .swipe-content or .swipe-delete-action', {
        container
      });
      return;
    }

    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;

    // Touch start
    const handleTouchStart = (e) => {
      startX = e.touches[0].clientX;
      currentX = startX;
      startTime = Date.now();
      isDragging = true;

      content.style.transition = 'none';
    };

    // Touch move
    const handleTouchMove = (e) => {
      if (!isDragging) return;

      currentX = e.touches[0].clientX;
      const deltaX = startX - currentX;

      // Only allow left swipe
      if (deltaX > 0 && deltaX <= this.deleteThreshold) {
        e.preventDefault();
        content.style.transform = `translateX(-${deltaX}px)`;

        // Visual feedback as approaching delete threshold
        if (deltaX > this.swipeThreshold) {
          deleteAction.style.background = '#FF3B30';
          deleteAction.querySelector('.delete-text').textContent = 'Release to Delete';
        } else {
          deleteAction.style.background = '#666';
          deleteAction.querySelector('.delete-text').textContent = 'Delete';
        }
      }
    };

    // Touch end
    const handleTouchEnd = async (e) => {
      if (!isDragging) return;

      isDragging = false;
      const deltaX = startX - currentX;
      const deltaTime = Date.now() - startTime;
      const velocity = deltaX / deltaTime;

      content.style.transition = 'transform 0.3s ease';

      // Fast swipe or full swipe = delete
      if (velocity > 0.5 || deltaX > this.deleteThreshold) {
        await this.handleDelete(container, content, options);
      }
      // Partial swipe = show delete button
      else if (deltaX > this.swipeThreshold / 2) {
        content.style.transform = `translateX(-${this.swipeThreshold}px)`;
        container.classList.add('swiped');

        // Setup delete button click
        deleteAction.onclick = async () => {
          await this.handleDelete(container, content, options);
        };
      }
      // Minimal swipe = snap back
      else {
        this.resetSwipe(container, content);
      }
    };

    // Mouse events for desktop testing
    let mouseDown = false;

    const handleMouseDown = (e) => {
      startX = e.clientX;
      currentX = startX;
      startTime = Date.now();
      mouseDown = true;
      content.style.transition = 'none';
    };

    const handleMouseMove = (e) => {
      if (!mouseDown) return;

      currentX = e.clientX;
      const deltaX = startX - currentX;

      if (deltaX > 0 && deltaX <= this.deleteThreshold) {
        e.preventDefault();
        content.style.transform = `translateX(-${deltaX}px)`;

        if (deltaX > this.swipeThreshold) {
          deleteAction.style.background = '#FF3B30';
          deleteAction.querySelector('.delete-text').textContent = 'Release to Delete';
        } else {
          deleteAction.style.background = '#666';
          deleteAction.querySelector('.delete-text').textContent = 'Delete';
        }
      }
    };

    const handleMouseUp = async (e) => {
      if (!mouseDown) return;

      mouseDown = false;
      const deltaX = startX - currentX;

      content.style.transition = 'transform 0.3s ease';

      if (deltaX > this.deleteThreshold) {
        await this.handleDelete(container, content, options);
      } else if (deltaX > this.swipeThreshold / 2) {
        content.style.transform = `translateX(-${this.swipeThreshold}px)`;
        container.classList.add('swiped');

        deleteAction.onclick = async () => {
          await this.handleDelete(container, content, options);
        };
      } else {
        this.resetSwipe(container, content);
      }
    };

    // Attach event listeners
    content.addEventListener('touchstart', handleTouchStart, { passive: false });
    content.addEventListener('touchmove', handleTouchMove, { passive: false });
    content.addEventListener('touchend', handleTouchEnd);

    content.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        this.resetSwipe(container, content);
      }
    });

    // Store references for cleanup
    container.swipeHandlers = {
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp
    };
  }

  /**
   * Handle delete action
   * @param {HTMLElement} container - Container element
   * @param {HTMLElement} content - Content element
   * @param {Object} options - Configuration
   * @private
   */
  async handleDelete(container, content, options) {
    const {
      itemType,
      onDelete,
      confirmDelete,
      showUndo,
      itemIdAttribute
    } = options;

    const itemId = container.getAttribute(itemIdAttribute);

    // Confirm if enabled
    if (confirmDelete) {
      const confirmed = confirm(`Delete this ${itemType}?`);
      if (!confirmed) {
        this.resetSwipe(container, content);
        return;
      }
    }

    // Animate delete
    content.style.transform = `translateX(-${window.innerWidth}px)`;
    content.style.opacity = '0';

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 300));

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
            if (confirm(error.message + '\n\nDelete vial AND all related injections?')) {
              result = deleteManager.forceDeleteVial(data.vials, data.injections, itemId);
              data.vials = result.vials;
              data.injections = result.injections;
            } else {
              this.resetSwipe(container, content);
              return;
            }
          }
          break;

        case 'weight':
          const timestamp = container.getAttribute('data-timestamp');
          result = deleteManager.deleteWeight(data.weights, timestamp);
          data.weights = result.weights;
          break;

        default:
          throw new Error('Unknown item type: ' + itemType);
      }

      // Save
      await resilientStorage.saveData(data);

      // Remove from DOM
      container.style.maxHeight = container.offsetHeight + 'px';
      setTimeout(() => {
        container.style.maxHeight = '0';
        container.style.margin = '0';
        container.style.padding = '0';
        container.style.opacity = '0';
      }, 10);

      setTimeout(() => {
        container.remove();
      }, 300);

      // Show notification
      notificationManager.success(`${itemType} deleted`, {
        duration: 2000
      });

      // Show undo option
      if (showUndo) {
        this.showUndoOption();
      }

      // Call custom handler
      if (onDelete && typeof onDelete === 'function') {
        onDelete(itemId, result);
      }

      logger.info('Item deleted via swipe', { itemType, itemId });

    } catch (error) {
      logger.error('Delete failed', { error: error.message });
      notificationManager.error('Failed to delete: ' + error.message);

      // Reset on error
      this.resetSwipe(container, content);
    }
  }

  /**
   * Reset swipe state
   * @param {HTMLElement} container - Container element
   * @param {HTMLElement} content - Content element
   * @private
   */
  resetSwipe(container, content) {
    content.style.transform = '';
    content.style.opacity = '';
    container.classList.remove('swiped');
  }

  /**
   * Show undo option
   * @private
   */
  showUndoOption() {
    if (!deleteManager.canUndo()) {
      return;
    }

    // Show floating undo button
    let undoBtn = document.getElementById('swipe-undo-btn');

    if (!undoBtn) {
      undoBtn = document.createElement('button');
      undoBtn.id = 'swipe-undo-btn';
      undoBtn.className = 'swipe-undo-btn';
      undoBtn.innerHTML = '↩️ Undo';
      document.body.appendChild(undoBtn);

      undoBtn.onclick = async () => {
        try {
          const data = await resilientStorage.loadData();
          const restored = deleteManager.undoLastDelete(data);
          await resilientStorage.saveData(restored);

          notificationManager.success('Delete undone!');

          // Reload page to show restored item
          setTimeout(() => location.reload(), 500);

        } catch (error) {
          notificationManager.error('Failed to undo: ' + error.message);
        }
      };
    }

    undoBtn.style.display = 'block';

    // Hide after 10 seconds
    setTimeout(() => {
      if (deleteManager.canUndo()) {
        undoBtn.style.display = 'none';
      }
    }, 10000);
  }

  /**
   * Inject styles for swipe-to-delete
   * @private
   */
  injectStyles() {
    if (document.getElementById('swipe-to-delete-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'swipe-to-delete-styles';
    style.textContent = `
      /* Swipe container */
      .swipe-container {
        position: relative;
        overflow: hidden;
        touch-action: pan-y;
      }

      /* Swipe content (slides left) */
      .swipe-content {
        position: relative;
        background: var(--card-bg, #1a1a1a);
        z-index: 2;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      /* Delete action (revealed by swipe) */
      .swipe-delete-action {
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        width: 80px;
        background: #666;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        z-index: 1;
        transition: background 0.2s;
      }

      .swipe-delete-action.active {
        background: #FF3B30;
      }

      .delete-icon {
        font-size: 24px;
        margin-bottom: 4px;
      }

      .delete-text {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }

      /* Undo button */
      .swipe-undo-btn {
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
      }

      .swipe-undo-btn:hover {
        transform: scale(1.05);
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
        .swipe-undo-btn {
          bottom: 20px;
          right: 20px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Create swipeable item HTML
   * @param {Object} content - Content configuration
   * @returns {string} HTML string
   */
  static createSwipeableItem(content) {
    const { id, html, itemType, timestamp } = content;

    const dataAttrs = timestamp
      ? `data-id="${id}" data-timestamp="${timestamp}"`
      : `data-id="${id}"`;

    return `
      <div class="swipe-container" ${dataAttrs}>
        <div class="swipe-delete-action">
          <div class="delete-icon">🗑️</div>
          <div class="delete-text">Delete</div>
        </div>
        <div class="swipe-content">
          ${html}
        </div>
      </div>
    `;
  }
}

// Create singleton instance
const swipeToDeleteManager = new SwipeToDeleteManager();

export default swipeToDeleteManager;
export { SwipeToDeleteManager };