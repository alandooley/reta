/**
 * Data Validation and Integrity Checking
 * Validates data structures and checks for inconsistencies
 */

import logger from '../utils/logger.js';
import { isValidNumber } from '../utils/utils.js';

/**
 * Validation result object
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<string>} errors - Array of error messages
 * @property {Array<string>} warnings - Array of warning messages
 */

/**
 * Validate complete application data integrity
 * @param {Object} data - Application data object
 * @param {Array} data.vials - Vials array
 * @param {Array} data.injections - Injections array
 * @param {Array} data.weights - Weights array
 * @returns {ValidationResult} Validation result
 */
export function validateDataIntegrity(data) {
  const issues = [];
  const warnings = [];

  if (!data) {
    return {
      valid: false,
      errors: ['Data object is null or undefined'],
      warnings: []
    };
  }

  // Validate vials
  if (data.vials && Array.isArray(data.vials)) {
    data.vials.forEach((vial, index) => {
      // Check if vial has been used more than its capacity
      if (vial.status === 'active' && vial.concentration_mg_ml > 0) {
        const totalUsedMg = vial.doses_used * (vial.total_mg / (vial.bac_water_ml * vial.concentration_mg_ml));
        const calculatedRemainingMg = vial.total_mg - totalUsedMg;
        const reportedRemainingMg = vial.remaining_ml * vial.concentration_mg_ml;

        if (Math.abs(calculatedRemainingMg - reportedRemainingMg) > 0.1) {
          issues.push(
            `Vial ${vial.vial_id || index}: Calculated remaining (${calculatedRemainingMg.toFixed(1)}mg) ` +
            `doesn't match reported (${reportedRemainingMg.toFixed(1)}mg)`
          );
        }
      }

      // Check for impossible remaining volumes
      if (vial.remaining_ml < 0) {
        issues.push(
          `Vial ${vial.vial_id || index}: Negative remaining volume (${vial.remaining_ml}ml)`
        );
      }

      // Check for vials marked as empty but still have volume
      if (vial.status === 'empty' && vial.remaining_ml > 0) {
        warnings.push(
          `Vial ${vial.vial_id || index}: Marked as empty but has ${vial.remaining_ml.toFixed(2)}ml remaining`
        );
      }

      // Check for expired active vials
      if (vial.status === 'active' && vial.expiration_date) {
        const expirationDate = new Date(vial.expiration_date);
        if (expirationDate < new Date()) {
          warnings.push(
            `Vial ${vial.vial_id || index}: Marked as active but expired on ${expirationDate.toLocaleDateString()}`
          );
        }
      }

      // Check for invalid concentrations
      if (vial.concentration_mg_ml <= 0) {
        issues.push(
          `Vial ${vial.vial_id || index}: Invalid concentration (${vial.concentration_mg_ml}mg/ml)`
        );
      }

      // Check for vials with more remaining than initial volume
      if (vial.remaining_ml > vial.bac_water_ml) {
        issues.push(
          `Vial ${vial.vial_id || index}: Remaining volume (${vial.remaining_ml}ml) exceeds initial volume (${vial.bac_water_ml}ml)`
        );
      }
    });
  }

  // Validate injections
  if (data.injections && Array.isArray(data.injections)) {
    data.injections.forEach((injection, index) => {
      // Check if injection references a valid vial
      if (data.vials && Array.isArray(data.vials)) {
        const vial = data.vials.find(v => v.vial_id === injection.vial_id);
        if (!vial) {
          issues.push(
            `Injection ${injection.id || index}: References non-existent vial ${injection.vial_id}`
          );
        }
      }

      // Check for invalid dose amounts
      if (!injection.dose_mg || injection.dose_mg <= 0) {
        issues.push(
          `Injection ${injection.id || index}: Invalid dose amount (${injection.dose_mg}mg)`
        );
      }

      // Check for future injections
      if (injection.timestamp && new Date(injection.timestamp) > new Date()) {
        warnings.push(
          `Injection ${injection.id || index}: Timestamp is in the future`
        );
      }

      // Check for missing required fields
      if (!injection.injection_site) {
        issues.push(
          `Injection ${injection.id || index}: Missing injection_site`
        );
      }
    });
  }

  // Validate weights
  if (data.weights && Array.isArray(data.weights)) {
    data.weights.forEach((weight, index) => {
      // Check for invalid weight values
      if (!weight.weight_kg || weight.weight_kg <= 0 || weight.weight_kg > 500) {
        issues.push(
          `Weight record ${index}: Invalid weight (${weight.weight_kg}kg)`
        );
      }

      // Check for future timestamps
      if (weight.timestamp && new Date(weight.timestamp) > new Date()) {
        warnings.push(
          `Weight record ${index}: Timestamp is in the future`
        );
      }
    });
  }

  // Log results
  if (issues.length > 0) {
    logger.warn('Data integrity issues found', { errors: issues, warnings });
  } else if (warnings.length > 0) {
    logger.info('Data integrity check passed with warnings', { warnings });
  } else {
    logger.info('Data integrity check passed');
  }

  return {
    valid: issues.length === 0,
    errors: issues,
    warnings: warnings
  };
}

/**
 * Validate injection data
 * @param {Object} injection - Injection object
 * @returns {ValidationResult} Validation result
 */
export function validateInjection(injection) {
  const errors = [];

  if (!injection) {
    return { valid: false, errors: ['Injection data is required'], warnings: [] };
  }

  if (!injection.dose_mg || !isValidNumber(injection.dose_mg) || injection.dose_mg <= 0) {
    errors.push('Valid dose_mg is required (must be positive number)');
  }

  if (injection.dose_mg > 100) {
    errors.push('Dose amount seems unusually high (>100mg)');
  }

  if (!injection.injection_site || typeof injection.injection_site !== 'string') {
    errors.push('Valid injection_site is required');
  }

  if (!injection.vial_id || typeof injection.vial_id !== 'string') {
    errors.push('Valid vial_id is required');
  }

  if (injection.weight_kg && (!isValidNumber(injection.weight_kg) || injection.weight_kg <= 0 || injection.weight_kg > 500)) {
    errors.push('Weight must be between 0 and 500 kg');
  }

  if (injection.timestamp) {
    const timestamp = new Date(injection.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push('Invalid timestamp format');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: []
  };
}

/**
 * Validate vial data
 * @param {Object} vial - Vial object
 * @returns {ValidationResult} Validation result
 */
export function validateVial(vial) {
  const errors = [];
  const warnings = [];

  if (!vial) {
    return { valid: false, errors: ['Vial data is required'], warnings: [] };
  }

  if (!vial.total_mg || !isValidNumber(vial.total_mg) || vial.total_mg <= 0) {
    errors.push('Valid total_mg is required (must be positive number)');
  }

  if (vial.total_mg > 1000) {
    warnings.push('Vial size seems unusually large (>1000mg)');
  }

  if (!vial.bac_water_ml || !isValidNumber(vial.bac_water_ml) || vial.bac_water_ml <= 0) {
    errors.push('Valid bac_water_ml is required (must be positive number)');
  }

  if (vial.bac_water_ml > 50) {
    warnings.push('BAC water volume seems unusually large (>50ml)');
  }

  if (!vial.order_date) {
    errors.push('order_date is required');
  } else {
    const orderDate = new Date(vial.order_date);
    if (isNaN(orderDate.getTime())) {
      errors.push('Invalid order_date format');
    } else if (orderDate > new Date()) {
      warnings.push('Order date is in the future');
    }
  }

  if (vial.reconstitution_date) {
    const reconDate = new Date(vial.reconstitution_date);
    if (isNaN(reconDate.getTime())) {
      errors.push('Invalid reconstitution_date format');
    } else if (reconDate > new Date()) {
      warnings.push('Reconstitution date is in the future');
    }
  }

  if (vial.concentration_mg_ml && vial.concentration_mg_ml <= 0) {
    errors.push('Concentration must be positive');
  }

  if (vial.remaining_ml !== undefined && vial.remaining_ml < 0) {
    errors.push('Remaining volume cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Validate weight data
 * @param {Object} weight - Weight object
 * @returns {ValidationResult} Validation result
 */
export function validateWeight(weight) {
  const errors = [];
  const warnings = [];

  if (!weight) {
    return { valid: false, errors: ['Weight data is required'], warnings: [] };
  }

  if (!weight.weight_kg || !isValidNumber(weight.weight_kg) || weight.weight_kg <= 0) {
    errors.push('Valid weight_kg is required (must be positive number)');
  }

  if (weight.weight_kg < 20) {
    warnings.push('Weight seems unusually low (<20kg)');
  }

  if (weight.weight_kg > 500) {
    errors.push('Weight must be less than 500kg');
  }

  if (weight.bmi && (!isValidNumber(weight.bmi) || weight.bmi <= 0 || weight.bmi > 100)) {
    errors.push('BMI must be between 0 and 100');
  }

  if (weight.body_fat_percentage && (!isValidNumber(weight.body_fat_percentage) || weight.body_fat_percentage < 0 || weight.body_fat_percentage > 100)) {
    errors.push('Body fat percentage must be between 0 and 100');
  }

  if (weight.timestamp) {
    const timestamp = new Date(weight.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push('Invalid timestamp format');
    } else if (timestamp > new Date()) {
      warnings.push('Timestamp is in the future');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate URL format
 * @param {string} url - URL string
 * @returns {boolean} True if valid
 */
export function validateURL(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ISO date string
 * @param {string} dateString - ISO date string
 * @returns {boolean} True if valid
 */
export function validateISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  const date = new Date(dateString);
  return !isNaN(date.getTime()) && date.toISOString() === dateString;
}

/**
 * Sanitize string input (prevent XSS)
 * @param {string} input - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove script tags and event handlers
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*'[^']*'/gi, '');

  return sanitized.trim();
}

/**
 * Validate numeric range
 * @param {number} value - Value to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if in range
 */
export function validateRange(value, min, max) {
  if (!isValidNumber(value) || !isValidNumber(min) || !isValidNumber(max)) {
    return false;
  }

  return value >= min && value <= max;
}

/**
 * Check if data structure is valid
 * @param {Object} data - Data object
 * @returns {boolean} True if structure is valid
 */
export function isValidDataStructure(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check for required arrays
  const hasValidVials = Array.isArray(data.vials);
  const hasValidInjections = Array.isArray(data.injections);
  const hasValidWeights = Array.isArray(data.weights);

  return hasValidVials && hasValidInjections && hasValidWeights;
}

/**
 * Repair common data issues
 * @param {Object} data - Data object to repair
 * @returns {Object} Repaired data object
 */
export function repairData(data) {
  if (!data || typeof data !== 'object') {
    logger.warn('repairData: Invalid data object, creating new structure');
    return {
      vials: [],
      injections: [],
      weights: [],
      settings: {}
    };
  }

  const repaired = { ...data };

  // Ensure arrays exist
  if (!Array.isArray(repaired.vials)) {
    logger.warn('repairData: vials is not an array, initializing');
    repaired.vials = [];
  }

  if (!Array.isArray(repaired.injections)) {
    logger.warn('repairData: injections is not an array, initializing');
    repaired.injections = [];
  }

  if (!Array.isArray(repaired.weights)) {
    logger.warn('repairData: weights is not an array, initializing');
    repaired.weights = [];
  }

  // Fix vials with negative remaining volumes
  repaired.vials.forEach(vial => {
    if (vial.remaining_ml < 0) {
      logger.warn(`repairData: Fixing negative remaining_ml for vial ${vial.vial_id}`);
      vial.remaining_ml = 0;
      vial.status = 'empty';
    }
  });

  // Remove injections with missing required fields
  const validInjections = repaired.injections.filter(injection => {
    const isValid = injection.dose_mg > 0 && injection.injection_site && injection.vial_id;
    if (!isValid) {
      logger.warn(`repairData: Removing invalid injection`, { injection });
    }
    return isValid;
  });
  repaired.injections = validInjections;

  // Remove weights with invalid values
  const validWeights = repaired.weights.filter(weight => {
    const isValid = weight.weight_kg > 0 && weight.weight_kg < 500;
    if (!isValid) {
      logger.warn(`repairData: Removing invalid weight`, { weight });
    }
    return isValid;
  });
  repaired.weights = validWeights;

  logger.info('repairData: Data repair complete', {
    vials: repaired.vials.length,
    injections: repaired.injections.length,
    weights: repaired.weights.length
  });

  return repaired;
}