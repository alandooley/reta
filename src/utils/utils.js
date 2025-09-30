/**
 * Utility Functions
 */

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
export function generateId() {
  return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

/**
 * Convert kilograms to pounds
 * @param {number} kg - Weight in kilograms
 * @returns {number} Weight in pounds
 */
export function kgToLbs(kg) {
  return kg * 2.20462;
}

/**
 * Convert pounds to kilograms
 * @param {number} lbs - Weight in pounds
 * @returns {number} Weight in kilograms
 */
export function lbsToKg(lbs) {
  return lbs / 2.20462;
}

/**
 * Format date to locale string
 * @param {string|Date} dateString - Date to format
 * @returns {string} Formatted date
 */
export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}

/**
 * Format datetime to locale string
 * @param {string|Date} dateString - Datetime to format
 * @returns {string} Formatted datetime
 */
export function formatDateTime(dateString) {
  return new Date(dateString).toLocaleString();
}

/**
 * Sanitize HTML input to prevent XSS
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
export function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Deep clone an object
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a valid number
 * @param {*} value - Value to check
 * @returns {boolean} True if valid number
 */
export function isValidNumber(value) {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Format number to fixed decimal places
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export function formatNumber(num, decimals = 2) {
  if (!isValidNumber(num)) return '0';
  return num.toFixed(decimals);
}

/**
 * Parse and validate a numeric input
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number} Parsed number or default
 */
export function parseNumericInput(value, defaultValue = 0) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return isValidNumber(parsed) ? parsed : defaultValue;
}

/**
 * Clamp a number between min and max values
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  if (!isValidNumber(value) || !isValidNumber(min) || !isValidNumber(max)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate and sanitize text input
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
export function sanitizeTextInput(input, maxLength = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove control characters and trim
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized.trim();
}

/**
 * Validate ISO date string
 * @param {string} dateString - ISO date string
 * @returns {boolean} True if valid
 */
export function isValidISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Get safe date string (ensures valid date or returns current date)
 * @param {string} dateString - Date string to validate
 * @returns {string} Valid ISO date string
 */
export function getSafeDateString(dateString) {
  if (isValidISODate(dateString)) {
    return dateString;
  }
  return new Date().toISOString();
}

/**
 * Compare two dates
 * @param {string|Date} date1 - First date
 * @param {string|Date} date2 - Second date
 * @returns {number} Negative if date1 < date2, positive if date1 > date2, 0 if equal
 */
export function compareDates(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getTime() - d2.getTime();
}

/**
 * Calculate days between two dates
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @returns {number} Number of days
 */
export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end.getTime() - start.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Round number to specified precision
 * @param {number} num - Number to round
 * @param {number} precision - Decimal places
 * @returns {number} Rounded number
 */
export function roundTo(num, precision = 2) {
  if (!isValidNumber(num)) return 0;
  const multiplier = Math.pow(10, precision);
  return Math.round(num * multiplier) / multiplier;
}

/**
 * Check if object has required properties
 * @param {Object} obj - Object to check
 * @param {Array<string>} requiredProps - Required property names
 * @returns {boolean} True if all required properties exist
 */
export function hasRequiredProperties(obj, requiredProps) {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  return requiredProps.every(prop => obj.hasOwnProperty(prop));
}

/**
 * Safely access nested property
 * @param {Object} obj - Object to access
 * @param {string} path - Dot-separated path (e.g., 'user.profile.name')
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Property value or default
 */
export function getNestedProperty(obj, path, defaultValue = null) {
  if (!obj || typeof obj !== 'object' || !path) {
    return defaultValue;
  }
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return defaultValue;
    }
  }
  return result;
}