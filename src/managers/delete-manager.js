/**
 * Delete Manager
 * Handles deletion of records with undo capability
 */

import logger from '../utils/logger.js';
import backupManager from '../core/backup-manager.js';

/**
 * Delete Manager Class
 */
class DeleteManager {
  constructor() {
    this.undoStack = [];
    this.maxUndoStack = 20;
  }

  /**
   * Delete an injection record
   * @param {Array} injections - Array of injection records
   * @param {string} injectionId - ID of injection to delete
   * @returns {Object} Updated injections array and deleted injection
   */
  deleteInjection(injections, injectionId) {
    try {
      const index = injections.findIndex(inj => inj.id === injectionId);

      if (index === -1) {
        throw new Error('Injection not found');
      }

      const deletedInjection = injections[index];

      // Create backup before deletion
      this.addToUndoStack({
        type: 'injection',
        action: 'delete',
        data: deletedInjection,
        index: index,
        timestamp: Date.now()
      });

      // Remove the injection
      const updated = [...injections];
      updated.splice(index, 1);

      logger.info('Injection deleted', {
        injectionId,
        dose_mg: deletedInjection.dose_mg,
        timestamp: deletedInjection.timestamp
      });

      return {
        injections: updated,
        deleted: deletedInjection
      };
    } catch (error) {
      logger.error('Failed to delete injection', {
        injectionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete a vial record
   * @param {Array} vials - Array of vial records
   * @param {string} vialId - ID of vial to delete
   * @param {Array} injections - Array of injection records (to check references)
   * @returns {Object} Updated vials array and deleted vial
   */
  deleteVial(vials, vialId, injections = []) {
    try {
      const index = vials.findIndex(vial => vial.vial_id === vialId);

      if (index === -1) {
        throw new Error('Vial not found');
      }

      // Check if vial is referenced by any injections
      const referencedInjections = injections.filter(inj => inj.vial_id === vialId);

      if (referencedInjections.length > 0) {
        logger.warn('Vial is referenced by injections', {
          vialId,
          injectionCount: referencedInjections.length
        });

        throw new Error(
          `Cannot delete vial: ${referencedInjections.length} injection(s) reference this vial. ` +
          `Delete the injections first or this may cause data inconsistency.`
        );
      }

      const deletedVial = vials[index];

      // Create backup before deletion
      this.addToUndoStack({
        type: 'vial',
        action: 'delete',
        data: deletedVial,
        index: index,
        timestamp: Date.now()
      });

      // Remove the vial
      const updated = [...vials];
      updated.splice(index, 1);

      logger.info('Vial deleted', {
        vialId,
        total_mg: deletedVial.total_mg,
        status: deletedVial.status
      });

      return {
        vials: updated,
        deleted: deletedVial
      };
    } catch (error) {
      logger.error('Failed to delete vial', {
        vialId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Force delete a vial and all associated injections
   * @param {Array} vials - Array of vial records
   * @param {Array} injections - Array of injection records
   * @param {string} vialId - ID of vial to delete
   * @returns {Object} Updated arrays and deleted items
   */
  forceDeleteVial(vials, injections, vialId) {
    try {
      const vialIndex = vials.findIndex(vial => vial.vial_id === vialId);

      if (vialIndex === -1) {
        throw new Error('Vial not found');
      }

      const deletedVial = vials[vialIndex];

      // Find all injections that reference this vial
      const referencedInjections = injections.filter(inj => inj.vial_id === vialId);
      const remainingInjections = injections.filter(inj => inj.vial_id !== vialId);

      // Create backup before deletion
      this.addToUndoStack({
        type: 'vial_cascade',
        action: 'delete',
        data: {
          vial: deletedVial,
          injections: referencedInjections
        },
        index: vialIndex,
        timestamp: Date.now()
      });

      // Remove the vial
      const updatedVials = [...vials];
      updatedVials.splice(vialIndex, 1);

      logger.info('Vial force deleted with injections', {
        vialId,
        deletedInjections: referencedInjections.length
      });

      return {
        vials: updatedVials,
        injections: remainingInjections,
        deleted: {
          vial: deletedVial,
          injections: referencedInjections
        }
      };
    } catch (error) {
      logger.error('Failed to force delete vial', {
        vialId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete a weight record
   * @param {Array} weights - Array of weight records
   * @param {string} timestamp - Timestamp of weight record to delete
   * @returns {Object} Updated weights array and deleted weight
   */
  deleteWeight(weights, timestamp) {
    try {
      const index = weights.findIndex(weight => weight.timestamp === timestamp);

      if (index === -1) {
        throw new Error('Weight record not found');
      }

      const deletedWeight = weights[index];

      // Create backup before deletion
      this.addToUndoStack({
        type: 'weight',
        action: 'delete',
        data: deletedWeight,
        index: index,
        timestamp: Date.now()
      });

      // Remove the weight record
      const updated = [...weights];
      updated.splice(index, 1);

      logger.info('Weight record deleted', {
        timestamp,
        weight_kg: deletedWeight.weight_kg
      });

      return {
        weights: updated,
        deleted: deletedWeight
      };
    } catch (error) {
      logger.error('Failed to delete weight record', {
        timestamp,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Delete multiple injections at once
   * @param {Array} injections - Array of injection records
   * @param {Array<string>} injectionIds - Array of injection IDs to delete
   * @returns {Object} Updated injections array and deleted injections
   */
  deleteMultipleInjections(injections, injectionIds) {
    try {
      const deleted = [];
      let updated = [...injections];

      for (const id of injectionIds) {
        const index = updated.findIndex(inj => inj.id === id);
        if (index !== -1) {
          deleted.push(updated[index]);
          updated.splice(index, 1);
        }
      }

      // Create backup before deletion
      this.addToUndoStack({
        type: 'injection_multiple',
        action: 'delete',
        data: deleted,
        timestamp: Date.now()
      });

      logger.info('Multiple injections deleted', {
        count: deleted.length
      });

      return {
        injections: updated,
        deleted: deleted
      };
    } catch (error) {
      logger.error('Failed to delete multiple injections', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Add an operation to the undo stack
   * @param {Object} operation - Operation details
   * @private
   */
  addToUndoStack(operation) {
    this.undoStack.push(operation);

    // Limit stack size
    if (this.undoStack.length > this.maxUndoStack) {
      this.undoStack.shift();
    }

    logger.debug('Operation added to undo stack', {
      type: operation.type,
      action: operation.action,
      stackSize: this.undoStack.length
    });
  }

  /**
   * Undo the last delete operation
   * @param {Object} currentData - Current application data
   * @returns {Object} Updated data with restored item
   */
  undoLastDelete(currentData) {
    try {
      if (this.undoStack.length === 0) {
        throw new Error('Nothing to undo');
      }

      const operation = this.undoStack.pop();
      const updatedData = { ...currentData };

      switch (operation.type) {
        case 'injection':
          updatedData.injections = [...currentData.injections];
          updatedData.injections.splice(operation.index, 0, operation.data);
          logger.info('Injection deletion undone', { id: operation.data.id });
          break;

        case 'vial':
          updatedData.vials = [...currentData.vials];
          updatedData.vials.splice(operation.index, 0, operation.data);
          logger.info('Vial deletion undone', { id: operation.data.vial_id });
          break;

        case 'vial_cascade':
          updatedData.vials = [...currentData.vials];
          updatedData.vials.splice(operation.index, 0, operation.data.vial);
          updatedData.injections = [
            ...currentData.injections,
            ...operation.data.injections
          ];
          logger.info('Vial cascade deletion undone', {
            vialId: operation.data.vial.vial_id,
            injectionCount: operation.data.injections.length
          });
          break;

        case 'weight':
          updatedData.weights = [...currentData.weights];
          updatedData.weights.splice(operation.index, 0, operation.data);
          logger.info('Weight deletion undone', { timestamp: operation.data.timestamp });
          break;

        case 'injection_multiple':
          updatedData.injections = [
            ...currentData.injections,
            ...operation.data
          ];
          logger.info('Multiple injection deletion undone', {
            count: operation.data.length
          });
          break;

        default:
          throw new Error('Unknown operation type: ' + operation.type);
      }

      return updatedData;
    } catch (error) {
      logger.error('Failed to undo delete', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Check if undo is available
   * @returns {boolean} True if undo is available
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Get information about the last operation
   * @returns {Object|null} Last operation info or null
   */
  getLastOperation() {
    if (this.undoStack.length === 0) {
      return null;
    }

    const operation = this.undoStack[this.undoStack.length - 1];

    return {
      type: operation.type,
      action: operation.action,
      timestamp: operation.timestamp,
      date: new Date(operation.timestamp).toLocaleString()
    };
  }

  /**
   * Clear the undo stack
   */
  clearUndoStack() {
    this.undoStack = [];
    logger.info('Undo stack cleared');
  }

  /**
   * Get undo stack size
   * @returns {number} Number of operations in undo stack
   */
  getUndoStackSize() {
    return this.undoStack.length;
  }
}

// Create singleton instance
const deleteManager = new DeleteManager();

export default deleteManager;
export { DeleteManager };