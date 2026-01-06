/**
 * Data Mapper Utility
 *
 * Provides canonical property mappings between localStorage format (snake_case)
 * and API format (camelCase) to resolve data flow integrity issues.
 *
 * Issue #2 Fix: Concentration field naming chaos
 * - localStorage uses: concentration_mg_ml
 * - API should use: concentrationMgMl (canonical)
 * - Legacy sync used: concentrationMgPerMl (deprecated)
 */

// Canonical property mappings: localStorage (snake_case) <-> API (camelCase)
const PROPERTY_MAP = {
    // Vial properties
    concentration_mg_ml: 'concentrationMgMl',
    current_volume_ml: 'currentVolumeMl',
    initial_volume_ml: 'initialVolumeMl',
    remaining_ml: 'remainingMl',
    volume_ml: 'volumeMl',
    used_volume_ml: 'usedVolumeMl',
    bac_water_ml: 'bacWaterMl',
    vial_id: 'vialId',
    lot_number: 'lotNumber',
    expiry_date: 'expiryDate',
    expiration_date: 'expirationDate',
    order_date: 'orderDate',
    opened_date: 'openedDate',
    start_date: 'startDate',

    // Injection properties
    dose_mg: 'doseMg',
    injection_site: 'site',
    planned_dose_mg: 'plannedDoseMg',

    // Weight properties
    weight_kg: 'weightKg',

    // Common properties
    created_at: 'createdAt',
    updated_at: 'updatedAt',
};

// Build reverse map for API -> localStorage conversion
const REVERSE_MAP = Object.fromEntries(
    Object.entries(PROPERTY_MAP).map(([snake, camel]) => [camel, snake])
);

// Legacy field names that should be normalized
const LEGACY_FIELDS = {
    concentrationMgPerMl: 'concentrationMgMl',  // Old sync format -> canonical
};

/**
 * Convert an object from localStorage format (snake_case) to API format (camelCase)
 * @param {Object} localData - Object with snake_case properties
 * @returns {Object} - Object with camelCase properties
 */
function toApiFormat(localData) {
    if (!localData || typeof localData !== 'object') {
        return localData;
    }

    const result = {};
    for (const [key, value] of Object.entries(localData)) {
        // Convert key to camelCase if mapping exists
        const apiKey = PROPERTY_MAP[key] || key;

        // Recursively convert nested objects (but not arrays or dates)
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            result[apiKey] = toApiFormat(value);
        } else if (Array.isArray(value)) {
            result[apiKey] = value.map(item =>
                typeof item === 'object' ? toApiFormat(item) : item
            );
        } else {
            result[apiKey] = value;
        }
    }
    return result;
}

/**
 * Convert an object from API format (camelCase) to localStorage format (snake_case)
 * @param {Object} apiData - Object with camelCase properties
 * @returns {Object} - Object with snake_case properties
 */
function toLocalFormat(apiData) {
    if (!apiData || typeof apiData !== 'object') {
        return apiData;
    }

    const result = {};
    for (const [key, value] of Object.entries(apiData)) {
        // First normalize any legacy field names
        const normalizedKey = LEGACY_FIELDS[key] || key;

        // Convert key to snake_case if mapping exists
        const localKey = REVERSE_MAP[normalizedKey] || normalizedKey;

        // Recursively convert nested objects
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            result[localKey] = toLocalFormat(value);
        } else if (Array.isArray(value)) {
            result[localKey] = value.map(item =>
                typeof item === 'object' ? toLocalFormat(item) : item
            );
        } else {
            result[localKey] = value;
        }
    }
    return result;
}

/**
 * Get concentration value from an object, regardless of which field name is used
 * Handles: concentration_mg_ml, concentrationMgMl, concentrationMgPerMl
 * @param {Object} obj - Object that may contain concentration in various formats
 * @returns {number|null} - The concentration value or null if not found
 */
function getConcentration(obj) {
    if (!obj) return null;
    return obj.concentration_mg_ml ?? obj.concentrationMgMl ?? obj.concentrationMgPerMl ?? null;
}

/**
 * Set concentration in an object using the appropriate format
 * @param {Object} obj - Object to modify
 * @param {number} value - Concentration value
 * @param {string} format - 'local' for snake_case, 'api' for camelCase
 */
function setConcentration(obj, value, format = 'local') {
    if (format === 'api') {
        obj.concentrationMgMl = value;
        // Clean up legacy/alternate fields
        delete obj.concentrationMgPerMl;
        delete obj.concentration_mg_ml;
    } else {
        obj.concentration_mg_ml = value;
        // Clean up camelCase fields for localStorage
        delete obj.concentrationMgMl;
        delete obj.concentrationMgPerMl;
    }
}

/**
 * Get vial ID from an object, regardless of which field name is used
 * Handles: id, vial_id, vialId (in priority order)
 * @param {Object} obj - Object that may contain vial ID in various formats
 * @returns {string|null} - The vial ID or null if not found
 */
function getVialId(obj) {
    if (!obj) return null;
    // Prefer 'id' as canonical, fall back to legacy formats
    return obj.id ?? obj.vial_id ?? obj.vialId ?? null;
}

/**
 * Set vial ID in an object using the appropriate format and clean up duplicates
 * Issue #4 fix: Vial ID inconsistency
 * @param {Object} obj - Object to modify
 * @param {string} value - Vial ID value
 * @param {string} format - 'local' for snake_case (uses id), 'api' for camelCase (uses id)
 * @returns {Object} - The modified object
 */
function setVialId(obj, value, format = 'local') {
    if (!obj) return obj;

    // Always use 'id' as the canonical field name (both formats use 'id')
    obj.id = value;

    // Clean up legacy field names to prevent confusion
    if (obj.vial_id !== undefined && obj.vial_id !== obj.id) {
        delete obj.vial_id;
    }
    if (obj.vialId !== undefined && obj.vialId !== obj.id) {
        delete obj.vialId;
    }

    return obj;
}

/**
 * Get dose from an object, regardless of which field name is used
 * Handles: dose_mg, doseMg
 * @param {Object} obj - Object that may contain dose in various formats
 * @returns {number|null} - The dose value or null if not found
 */
function getDose(obj) {
    if (!obj) return null;
    return obj.dose_mg ?? obj.doseMg ?? null;
}

/**
 * Calculate dose from volume and concentration
 * Issue #5 fix: Provides consistent dose calculation regardless of field names
 * @param {Object} obj - Object containing volume and concentration fields (can be mixed formats)
 * @returns {number|null} - The calculated dose in mg, or null if missing data
 */
function calculateDose(obj) {
    if (!obj) return null;

    // Get volume (handles all field name variants)
    const volume = obj.volume_ml ?? obj.volumeMl ?? null;

    // Get concentration (handles all field name variants)
    const concentration = getConcentration(obj);

    // Only calculate if both values are valid numbers
    if (volume === null || concentration === null) return null;
    if (typeof volume !== 'number' || typeof concentration !== 'number') {
        const parsedVolume = parseFloat(volume);
        const parsedConcentration = parseFloat(concentration);
        if (isNaN(parsedVolume) || isNaN(parsedConcentration)) return null;
        return parsedVolume * parsedConcentration;
    }

    return volume * concentration;
}

/**
 * Get volume from an object, regardless of which field name is used
 * Handles: volume_ml, volumeMl
 * @param {Object} obj - Object that may contain volume in various formats
 * @returns {number|null} - The volume value or null if not found
 */
function getVolume(obj) {
    if (!obj) return null;
    return obj.volume_ml ?? obj.volumeMl ?? null;
}

/**
 * Get remaining volume from an object
 * Handles: remaining_ml, remainingMl, current_volume_ml, currentVolumeMl
 * @param {Object} obj - Object that may contain remaining volume in various formats
 * @returns {number|null} - The remaining volume or null if not found
 */
function getRemainingVolume(obj) {
    if (!obj) return null;
    return obj.remaining_ml ?? obj.remainingMl ?? obj.current_volume_ml ?? obj.currentVolumeMl ?? null;
}

/**
 * Normalize a vial object to ensure all fields are consistent
 * Issue #4 fix: Also normalizes vial ID to canonical 'id' field
 * @param {Object} vial - Vial object with potentially mixed field names
 * @param {string} format - 'local' for snake_case, 'api' for camelCase
 * @returns {Object} - Normalized vial object
 */
function normalizeVial(vial, format = 'local') {
    if (!vial) return vial;

    const normalized = { ...vial };

    // Normalize concentration
    const concentration = getConcentration(vial);
    if (concentration !== null) {
        setConcentration(normalized, concentration, format);
    }

    // Normalize vial ID (Issue #4 fix)
    const vialId = getVialId(vial);
    if (vialId !== null) {
        setVialId(normalized, vialId, format);
    }

    return normalized;
}

/**
 * Normalize an injection object to ensure all fields are consistent
 * @param {Object} injection - Injection object with potentially mixed field names
 * @param {string} format - 'local' for snake_case, 'api' for camelCase
 * @returns {Object} - Normalized injection object
 */
function normalizeInjection(injection, format = 'local') {
    if (!injection) return injection;

    const normalized = { ...injection };
    const concentration = getConcentration(injection);

    if (concentration !== null) {
        setConcentration(normalized, concentration, format);
    }

    return normalized;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROPERTY_MAP,
        REVERSE_MAP,
        LEGACY_FIELDS,
        toApiFormat,
        toLocalFormat,
        getConcentration,
        setConcentration,
        getVialId,
        setVialId,  // Issue #4 fix
        getDose,
        calculateDose,  // Issue #5 fix
        getVolume,
        getRemainingVolume,
        normalizeVial,
        normalizeInjection
    };
}

// Also expose globally for browser usage
if (typeof window !== 'undefined') {
    window.DataMapper = {
        PROPERTY_MAP,
        REVERSE_MAP,
        LEGACY_FIELDS,
        toApiFormat,
        toLocalFormat,
        getConcentration,
        setConcentration,
        getVialId,
        setVialId,  // Issue #4 fix
        getDose,
        calculateDose,  // Issue #5 fix
        getVolume,
        getRemainingVolume,
        normalizeVial,
        normalizeInjection
    };
}
