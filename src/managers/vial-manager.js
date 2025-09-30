/**
 * Vial Management Module
 * Handles vial creation, expiration calculation, and active vial selection
 */

import { generateId } from '../utils/utils.js';
import logger from '../utils/logger.js';

/**
 * Add a new vial to the system
 * @param {Object} vial - Vial data
 * @param {string} vial.order_date - Date vial was ordered (ISO format)
 * @param {number} vial.total_mg - Total medication in vial (mg)
 * @param {number} vial.bac_water_ml - Volume of bacteriostatic water (ml)
 * @param {string} [vial.reconstitution_date] - Date vial was reconstituted (ISO format)
 * @param {string} [vial.supplier] - Supplier name
 * @param {string} [vial.lot_number] - Lot/batch number
 * @returns {Object} New vial record
 * @throws {Error} If required fields are missing or invalid
 */
export function addVial(vial) {
  // Validate required fields
  if (!vial) {
    const error = new Error('Vial data is required');
    logger.error('addVial failed: Missing vial data');
    throw error;
  }

  if (!vial.order_date) {
    const error = new Error('order_date is required');
    logger.error('addVial failed: Missing order_date');
    throw error;
  }

  if (!vial.total_mg || vial.total_mg <= 0) {
    const error = new Error('Valid total_mg is required');
    logger.error('addVial failed: Invalid total_mg', { total_mg: vial.total_mg });
    throw error;
  }

  if (!vial.bac_water_ml || vial.bac_water_ml <= 0) {
    const error = new Error('Valid bac_water_ml is required');
    logger.error('addVial failed: Invalid bac_water_ml', { bac_water_ml: vial.bac_water_ml });
    throw error;
  }

  try {
    // Calculate concentration
    const concentration = vial.total_mg / vial.bac_water_ml;

    const newVial = {
      vial_id: generateId(),
      order_date: vial.order_date,
      supplier: vial.supplier || '',
      lot_number: vial.lot_number || '',
      total_mg: parseFloat(vial.total_mg),
      bac_water_ml: parseFloat(vial.bac_water_ml),
      concentration_mg_ml: concentration,
      reconstitution_date: vial.reconstitution_date || null,
      expiration_date: calculateExpirationDate(vial.reconstitution_date, vial.order_date),
      remaining_ml: parseFloat(vial.bac_water_ml),
      doses_used: 0,
      status: 'active'
    };

    logger.info('Vial added successfully', {
      vial_id: newVial.vial_id,
      total_mg: newVial.total_mg,
      concentration: concentration.toFixed(2),
      expiration_date: newVial.expiration_date
    });

    return newVial;
  } catch (error) {
    logger.error('Failed to add vial', { error: error.message, vial });
    throw error;
  }
}

/**
 * Calculate expiration date for a vial
 * @param {string} [reconstitutionDate] - ISO date string when vial was reconstituted
 * @param {string} [orderDate] - ISO date string when vial was ordered
 * @returns {string} ISO date string of expiration
 */
export function calculateExpirationDate(reconstitutionDate, orderDate) {
  try {
    if (reconstitutionDate) {
      // Reconstituted peptide lasts 30 days in refrigerator
      const date = new Date(reconstitutionDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid reconstitution date');
      }
      date.setDate(date.getDate() + 30);
      logger.debug('Expiration calculated from reconstitution date', {
        reconstitutionDate,
        expirationDate: date.toISOString(),
        daysAdded: 30
      });
      return date.toISOString();
    } else if (orderDate) {
      // Lyophilized powder lasts 2 years in freezer
      const date = new Date(orderDate);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid order date');
      }
      date.setFullYear(date.getFullYear() + 2);
      logger.debug('Expiration calculated from order date', {
        orderDate,
        expirationDate: date.toISOString(),
        yearsAdded: 2
      });
      return date.toISOString();
    } else {
      // Default to 2 years from now
      const date = new Date();
      date.setFullYear(date.getFullYear() + 2);
      logger.warn('No dates provided, using default expiration (2 years from now)', {
        expirationDate: date.toISOString()
      });
      return date.toISOString();
    }
  } catch (error) {
    logger.error('Failed to calculate expiration date', {
      error: error.message,
      reconstitutionDate,
      orderDate
    });
    // Return default expiration on error
    const date = new Date();
    date.setFullYear(date.getFullYear() + 2);
    return date.toISOString();
  }
}

/**
 * Get the active vial that can fulfill the next planned dose
 * @param {Array} vials - Array of vial records
 * @param {number} [plannedDose] - Next planned dose in mg (default 4.0)
 * @returns {Object|null} Active vial or null if none available
 */
export function getActiveVial(vials, plannedDose = 4.0) {
  if (!Array.isArray(vials)) {
    logger.warn('getActiveVial called with non-array', { type: typeof vials });
    return null;
  }

  if (vials.length === 0) {
    logger.info('No vials available');
    return null;
  }

  const now = new Date();

  // Find first vial that meets all criteria
  const activeVial = vials.find(vial => {
    // Check basic status
    if (vial.status !== 'active') {
      return false;
    }

    // Check if not expired
    const expirationDate = new Date(vial.expiration_date);
    if (expirationDate <= now) {
      logger.debug('Vial expired', {
        vial_id: vial.vial_id,
        expiration_date: vial.expiration_date
      });
      return false;
    }

    // Check if has enough medication for next dose
    const remainingMg = vial.remaining_ml * vial.concentration_mg_ml;
    if (remainingMg < plannedDose) {
      logger.debug('Vial has insufficient medication', {
        vial_id: vial.vial_id,
        remaining_mg: remainingMg.toFixed(2),
        planned_dose: plannedDose
      });
      return false;
    }

    return true;
  });

  if (activeVial) {
    logger.info('Active vial found', {
      vial_id: activeVial.vial_id,
      remaining_ml: activeVial.remaining_ml.toFixed(2),
      remaining_mg: (activeVial.remaining_ml * activeVial.concentration_mg_ml).toFixed(2)
    });
  } else {
    logger.warn('No active vial available', { plannedDose });
  }

  return activeVial || null;
}

/**
 * Sort vials by reconstitution date (newest first)
 * @param {Array} vials - Array of vial records
 * @returns {Array} Sorted array
 */
export function sortVials(vials) {
  if (!Array.isArray(vials)) {
    logger.warn('sortVials called with non-array', { type: typeof vials });
    return [];
  }

  return vials.sort((a, b) => {
    const dateA = new Date(a.reconstitution_date || a.order_date);
    const dateB = new Date(b.reconstitution_date || b.order_date);
    return dateB - dateA;
  });
}

/**
 * Check if vial is expired
 * @param {Object} vial - Vial record
 * @returns {boolean} True if expired
 */
export function isVialExpired(vial) {
  if (!vial || !vial.expiration_date) {
    logger.warn('isVialExpired called with invalid vial', { vial });
    return true;
  }

  const now = new Date();
  const expirationDate = new Date(vial.expiration_date);

  return expirationDate <= now;
}

/**
 * Get remaining medication in a vial (in mg)
 * @param {Object} vial - Vial record
 * @returns {number} Remaining medication in mg
 */
export function getRemainingMedicationMg(vial) {
  if (!vial || !vial.remaining_ml || !vial.concentration_mg_ml) {
    logger.warn('getRemainingMedicationMg called with invalid vial', { vial });
    return 0;
  }

  return vial.remaining_ml * vial.concentration_mg_ml;
}

/**
 * Get all expired vials
 * @param {Array} vials - Array of vial records
 * @returns {Array} Array of expired vials
 */
export function getExpiredVials(vials) {
  if (!Array.isArray(vials)) {
    return [];
  }

  return vials.filter(vial => isVialExpired(vial));
}

/**
 * Get vials expiring soon (within specified days)
 * @param {Array} vials - Array of vial records
 * @param {number} [days] - Number of days to check (default 7)
 * @returns {Array} Array of vials expiring soon
 */
export function getVialExpiringSoon(vials, days = 7) {
  if (!Array.isArray(vials)) {
    return [];
  }

  const now = new Date();
  const threshold = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return vials.filter(vial => {
    if (!vial.expiration_date) return false;

    const expirationDate = new Date(vial.expiration_date);
    return expirationDate > now && expirationDate <= threshold;
  });
}