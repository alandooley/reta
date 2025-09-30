/**
 * Injection Management Module
 * Handles adding injections and updating vial usage
 */

import { generateId } from '../utils/utils.js';
import logger from '../utils/logger.js';
import { calculateCurrentMedicationLevel } from '../calculations/pharmacokinetics.js';

/**
 * Add a new injection record
 * @param {Object} injection - Injection data
 * @param {number} injection.dose_mg - Dose amount in mg
 * @param {string} injection.injection_site - Injection site
 * @param {string} injection.vial_id - Vial ID used
 * @param {string} [injection.timestamp] - ISO timestamp (defaults to now)
 * @param {number} [injection.weight_kg] - Weight at injection time
 * @param {string} [injection.weight_source] - Source of weight data
 * @param {string} [injection.notes] - Additional notes
 * @param {Array} existingInjections - Array of existing injections for medication level calculation
 * @returns {Object} New injection record
 * @throws {Error} If required fields are missing or invalid
 */
export function addInjection(injection, existingInjections = []) {
  // Validate required fields
  if (!injection) {
    const error = new Error('Injection data is required');
    logger.error('addInjection failed: Missing injection data');
    throw error;
  }

  if (!injection.dose_mg || injection.dose_mg <= 0) {
    const error = new Error('Valid dose_mg is required');
    logger.error('addInjection failed: Invalid dose_mg', { dose_mg: injection.dose_mg });
    throw error;
  }

  if (!injection.injection_site) {
    const error = new Error('injection_site is required');
    logger.error('addInjection failed: Missing injection_site');
    throw error;
  }

  if (!injection.vial_id) {
    const error = new Error('vial_id is required');
    logger.error('addInjection failed: Missing vial_id');
    throw error;
  }

  try {
    const timestamp = injection.timestamp || new Date().toISOString();

    // Calculate medication level at time of injection
    const medicationLevelAtInjection = calculateCurrentMedicationLevel(
      existingInjections,
      new Date(timestamp)
    );

    const newInjection = {
      id: generateId(),
      timestamp: timestamp,
      dose_mg: parseFloat(injection.dose_mg),
      injection_site: injection.injection_site,
      vial_id: injection.vial_id,
      weight_kg: injection.weight_kg ? parseFloat(injection.weight_kg) : null,
      weight_source: injection.weight_source || 'manual',
      notes: injection.notes || '',
      medication_level_at_injection: medicationLevelAtInjection
    };

    logger.info('Injection added successfully', {
      id: newInjection.id,
      dose_mg: newInjection.dose_mg,
      vial_id: newInjection.vial_id,
      medication_level: medicationLevelAtInjection.toFixed(2)
    });

    return newInjection;
  } catch (error) {
    logger.error('Failed to add injection', { error: error.message, injection });
    throw error;
  }
}

/**
 * Update vial usage after injection
 * @param {Object} vial - Vial object to update
 * @param {number} doseMg - Dose amount in mg
 * @param {number} [plannedDose] - Next planned dose in mg (default 4.0)
 * @returns {Object} Updated vial object
 * @throws {Error} If vial not found or invalid parameters
 */
export function updateVialUsage(vial, doseMg, plannedDose = 4.0) {
  if (!vial) {
    const error = new Error('Vial object is required');
    logger.error('updateVialUsage failed: Missing vial');
    throw error;
  }

  if (!doseMg || doseMg <= 0) {
    const error = new Error('Valid dose amount is required');
    logger.error('updateVialUsage failed: Invalid doseMg', { doseMg });
    throw error;
  }

  if (!vial.concentration_mg_ml || vial.concentration_mg_ml <= 0) {
    const error = new Error('Vial has invalid concentration');
    logger.error('updateVialUsage failed: Invalid concentration', {
      vial_id: vial.vial_id,
      concentration: vial.concentration_mg_ml
    });
    throw error;
  }

  try {
    // Calculate volume used for this dose
    const doseVolumeML = doseMg / vial.concentration_mg_ml;

    // Update remaining volume
    const previousRemaining = vial.remaining_ml;
    vial.remaining_ml = Math.max(0, vial.remaining_ml - doseVolumeML);
    vial.doses_used = (vial.doses_used || 0) + 1;

    // Calculate remaining medication in mg
    const remainingMg = vial.remaining_ml * vial.concentration_mg_ml;

    // Update vial status based on remaining medication
    if (remainingMg < plannedDose && remainingMg > 0) {
      // Mark vial as insufficient if it can't provide the next planned dose
      vial.status = 'insufficient';
      vial.remaining_ml = 0; // Mark as empty since it can't fulfill next dose
      logger.info('Vial marked as insufficient', {
        vial_id: vial.vial_id,
        remainingMg: remainingMg.toFixed(2),
        plannedDose: plannedDose
      });
    } else if (vial.remaining_ml <= 0) {
      vial.status = 'empty';
      logger.info('Vial marked as empty', { vial_id: vial.vial_id });
    }

    logger.debug('Vial usage updated', {
      vial_id: vial.vial_id,
      dose_mg: doseMg,
      volume_used_ml: doseVolumeML.toFixed(2),
      previous_remaining_ml: previousRemaining.toFixed(2),
      new_remaining_ml: vial.remaining_ml.toFixed(2),
      doses_used: vial.doses_used,
      status: vial.status
    });

    return vial;
  } catch (error) {
    logger.error('Failed to update vial usage', {
      error: error.message,
      vial_id: vial.vial_id,
      doseMg
    });
    throw error;
  }
}

/**
 * Sort injections by timestamp (newest first)
 * @param {Array} injections - Array of injection records
 * @returns {Array} Sorted array
 */
export function sortInjections(injections) {
  if (!Array.isArray(injections)) {
    logger.warn('sortInjections called with non-array', { type: typeof injections });
    return [];
  }

  return injections.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );
}

/**
 * Get most recent injection
 * @param {Array} injections - Array of injection records
 * @returns {Object|null} Most recent injection or null
 */
export function getMostRecentInjection(injections) {
  if (!Array.isArray(injections) || injections.length === 0) {
    return null;
  }

  const sorted = sortInjections([...injections]);
  return sorted[0];
}

/**
 * Get injections for a specific vial
 * @param {Array} injections - Array of injection records
 * @param {string} vialId - Vial ID to filter by
 * @returns {Array} Injections using the specified vial
 */
export function getInjectionsForVial(injections, vialId) {
  if (!Array.isArray(injections) || !vialId) {
    return [];
  }

  return injections.filter(injection => injection.vial_id === vialId);
}