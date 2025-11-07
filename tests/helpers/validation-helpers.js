/**
 * Validation Helpers
 * Reusable validation assertions for test data
 */

const { INJECTION_SITES, VIAL_STATUSES, SYNC_STATUSES } = require('../fixtures/test-data');

/**
 * Validate injection object has all required fields
 * @param {Object} injection - Injection object to validate
 * @throws {Error} If validation fails
 */
function validateInjectionStructure(injection) {
  const requiredFields = ['id', 'timestamp', 'dose_mg', 'injection_site'];

  for (const field of requiredFields) {
    if (!(field in injection)) {
      throw new Error(`Injection missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof injection.id !== 'string') {
    throw new Error(`Injection id must be string, got ${typeof injection.id}`);
  }

  if (typeof injection.timestamp !== 'string') {
    throw new Error(`Injection timestamp must be string, got ${typeof injection.timestamp}`);
  }

  if (typeof injection.dose_mg !== 'number') {
    throw new Error(`Injection dose_mg must be number, got ${typeof injection.dose_mg}`);
  }

  if (typeof injection.injection_site !== 'string') {
    throw new Error(`Injection injection_site must be string, got ${typeof injection.injection_site}`);
  }
}

/**
 * Validate injection has valid values
 * @param {Object} injection - Injection object to validate
 * @throws {Error} If validation fails
 */
function validateInjectionValues(injection) {
  // Validate dose range
  if (injection.dose_mg < 0 || injection.dose_mg > 50) {
    throw new Error(`Injection dose_mg must be 0-50, got ${injection.dose_mg}`);
  }

  // Validate injection site
  if (!INJECTION_SITES.includes(injection.injection_site)) {
    throw new Error(`Invalid injection_site: ${injection.injection_site}. Must be one of: ${INJECTION_SITES.join(', ')}`);
  }

  // Validate timestamp format
  const timestamp = new Date(injection.timestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Invalid timestamp format: ${injection.timestamp}`);
  }

  // Validate timestamp is not in the future
  if (timestamp > new Date()) {
    throw new Error(`Injection timestamp cannot be in the future: ${injection.timestamp}`);
  }
}

/**
 * Validate vial object has all required fields
 * @param {Object} vial - Vial object to validate
 * @throws {Error} If validation fails
 */
function validateVialStructure(vial) {
  const requiredFields = ['vial_id', 'order_date', 'total_mg', 'status'];

  for (const field of requiredFields) {
    if (!(field in vial)) {
      throw new Error(`Vial missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof vial.vial_id !== 'string') {
    throw new Error(`Vial vial_id must be string, got ${typeof vial.vial_id}`);
  }

  if (typeof vial.order_date !== 'string') {
    throw new Error(`Vial order_date must be string, got ${typeof vial.order_date}`);
  }

  if (typeof vial.total_mg !== 'number') {
    throw new Error(`Vial total_mg must be number, got ${typeof vial.total_mg}`);
  }

  if (typeof vial.status !== 'string') {
    throw new Error(`Vial status must be string, got ${typeof vial.status}`);
  }
}

/**
 * Validate vial has valid values
 * @param {Object} vial - Vial object to validate
 * @throws {Error} If validation fails
 */
function validateVialValues(vial) {
  // Validate total_mg range
  if (vial.total_mg < 0 || vial.total_mg > 100) {
    throw new Error(`Vial total_mg must be 0-100, got ${vial.total_mg}`);
  }

  // Validate status
  if (!VIAL_STATUSES.includes(vial.status)) {
    throw new Error(`Invalid vial status: ${vial.status}. Must be one of: ${VIAL_STATUSES.join(', ')}`);
  }

  // If vial is active, validate reconstitution fields
  if (vial.status === 'active' || vial.status === 'activated') {
    if (!vial.reconstitution_date) {
      throw new Error('Active vial must have reconstitution_date');
    }

    if (!vial.bac_water_ml || vial.bac_water_ml <= 0) {
      throw new Error('Active vial must have positive bac_water_ml');
    }

    if (!vial.concentration_mg_ml || vial.concentration_mg_ml <= 0) {
      throw new Error('Active vial must have positive concentration_mg_ml');
    }

    // Validate concentration calculation
    const expectedConcentration = vial.total_mg / vial.bac_water_ml;
    const tolerance = 0.01;
    if (Math.abs(vial.concentration_mg_ml - expectedConcentration) > tolerance) {
      throw new Error(
        `Vial concentration_mg_ml (${vial.concentration_mg_ml}) doesn't match total_mg/bac_water_ml (${expectedConcentration})`
      );
    }
  }

  // Validate remaining_ml
  if (vial.remaining_ml !== null && vial.remaining_ml !== undefined) {
    if (vial.remaining_ml < 0) {
      throw new Error(`Vial remaining_ml cannot be negative, got ${vial.remaining_ml}`);
    }

    if (vial.bac_water_ml && vial.remaining_ml > vial.bac_water_ml) {
      throw new Error(`Vial remaining_ml (${vial.remaining_ml}) cannot exceed bac_water_ml (${vial.bac_water_ml})`);
    }
  }
}

/**
 * Validate weight object has all required fields
 * @param {Object} weight - Weight object to validate
 * @throws {Error} If validation fails
 */
function validateWeightStructure(weight) {
  const requiredFields = ['id', 'timestamp', 'weight_kg'];

  for (const field of requiredFields) {
    if (!(field in weight)) {
      throw new Error(`Weight missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof weight.id !== 'string') {
    throw new Error(`Weight id must be string, got ${typeof weight.id}`);
  }

  if (typeof weight.timestamp !== 'string') {
    throw new Error(`Weight timestamp must be string, got ${typeof weight.timestamp}`);
  }

  if (typeof weight.weight_kg !== 'number') {
    throw new Error(`Weight weight_kg must be number, got ${typeof weight.weight_kg}`);
  }
}

/**
 * Validate weight has valid values
 * @param {Object} weight - Weight object to validate
 * @throws {Error} If validation fails
 */
function validateWeightValues(weight) {
  // Validate weight range (reasonable human weights)
  if (weight.weight_kg < 20 || weight.weight_kg > 300) {
    throw new Error(`Weight weight_kg must be 20-300, got ${weight.weight_kg}`);
  }

  // Validate timestamp format
  const timestamp = new Date(weight.timestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Invalid timestamp format: ${weight.timestamp}`);
  }

  // Validate weight_lbs calculation if present
  if (weight.weight_lbs !== null && weight.weight_lbs !== undefined) {
    const expectedLbs = weight.weight_kg * 2.20462;
    const tolerance = 0.1;
    if (Math.abs(weight.weight_lbs - expectedLbs) > tolerance) {
      throw new Error(
        `Weight weight_lbs (${weight.weight_lbs}) doesn't match weight_kg * 2.20462 (${expectedLbs})`
      );
    }
  }
}

/**
 * Validate sync queue operation structure
 * @param {Object} operation - Sync queue operation
 * @throws {Error} If validation fails
 */
function validateSyncQueueOperation(operation) {
  const requiredFields = ['id', 'type', 'entity', 'status', 'retryCount', 'addedAt'];

  for (const field of requiredFields) {
    if (!(field in operation)) {
      throw new Error(`Sync queue operation missing required field: ${field}`);
    }
  }

  // Validate type
  const validTypes = ['create', 'update', 'delete'];
  if (!validTypes.includes(operation.type)) {
    throw new Error(`Invalid operation type: ${operation.type}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate entity
  const validEntities = ['injection', 'vial', 'weight'];
  if (!validEntities.includes(operation.entity)) {
    throw new Error(`Invalid entity: ${operation.entity}. Must be one of: ${validEntities.join(', ')}`);
  }

  // Validate status
  if (!SYNC_STATUSES.includes(operation.status)) {
    throw new Error(`Invalid status: ${operation.status}. Must be one of: ${SYNC_STATUSES.join(', ')}`);
  }

  // Validate retryCount
  if (typeof operation.retryCount !== 'number' || operation.retryCount < 0) {
    throw new Error(`Invalid retryCount: ${operation.retryCount}. Must be non-negative number`);
  }

  // Max retries should be 5
  if (operation.retryCount > 5) {
    throw new Error(`RetryCount exceeds maximum (5): ${operation.retryCount}`);
  }
}

/**
 * Validate that two injections are duplicates
 * @param {Object} injection1 - First injection
 * @param {Object} injection2 - Second injection
 * @returns {boolean} True if duplicates
 */
function areDuplicateInjections(injection1, injection2) {
  // Duplicates have same timestamp, dose_mg, and injection_site
  return (
    injection1.timestamp === injection2.timestamp &&
    Math.abs(injection1.dose_mg - injection2.dose_mg) < 0.001 &&
    injection1.injection_site === injection2.injection_site
  );
}

/**
 * Validate data consistency between localStorage and UI
 * @param {Array} localStorageData - Data from localStorage
 * @param {number} uiCount - Count from UI (e.g., table rows)
 * @throws {Error} If counts don't match
 */
function validateDataConsistency(localStorageData, uiCount) {
  const storageCount = localStorageData.length;
  if (storageCount !== uiCount) {
    throw new Error(
      `Data inconsistency: localStorage has ${storageCount} records but UI shows ${uiCount}`
    );
  }
}

/**
 * Validate BMI calculation
 * @param {number} weightKg - Weight in kg
 * @param {number} heightCm - Height in cm
 * @param {number} calculatedBMI - Calculated BMI value
 * @throws {Error} If BMI calculation is incorrect
 */
function validateBMICalculation(weightKg, heightCm, calculatedBMI) {
  const heightM = heightCm / 100;
  const expectedBMI = weightKg / (heightM * heightM);
  const tolerance = 0.1;

  if (Math.abs(calculatedBMI - expectedBMI) > tolerance) {
    throw new Error(
      `BMI calculation incorrect: expected ${expectedBMI.toFixed(1)}, got ${calculatedBMI.toFixed(1)}`
    );
  }

  // Validate BMI is in reasonable range
  if (calculatedBMI < 10 || calculatedBMI > 60) {
    throw new Error(`BMI out of reasonable range (10-60): ${calculatedBMI}`);
  }
}

/**
 * Validate vial usage calculation
 * @param {Object} vial - Vial object
 * @param {number} expectedUsedMl - Expected volume used
 * @throws {Error} If usage calculation is incorrect
 */
function validateVialUsage(vial, expectedUsedMl) {
  const actualUsed = vial.bac_water_ml - vial.remaining_ml;
  const tolerance = 0.01;

  if (Math.abs(actualUsed - expectedUsedMl) > tolerance) {
    throw new Error(
      `Vial usage incorrect: expected ${expectedUsedMl.toFixed(3)}ml used, got ${actualUsed.toFixed(3)}ml`
    );
  }
}

// Export all validators
module.exports = {
  validateInjectionStructure,
  validateInjectionValues,
  validateVialStructure,
  validateVialValues,
  validateWeightStructure,
  validateWeightValues,
  validateSyncQueueOperation,
  areDuplicateInjections,
  validateDataConsistency,
  validateBMICalculation,
  validateVialUsage
};
