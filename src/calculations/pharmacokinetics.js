/**
 * Pharmacokinetics Calculations
 * Half-life and medication level calculations
 */

import { APP_CONFIG } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Simple memoization cache for calculation results
 */
const calculationCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 60000; // 1 minute TTL

/**
 * Generate cache key for medication level calculation
 * @private
 */
function generateCacheKey(injections, currentTime) {
  const injectionsHash = injections
    .map(inj => `${inj.timestamp}:${inj.dose_mg}`)
    .join('|');
  return `${injectionsHash}:${currentTime.getTime()}`;
}

/**
 * Get cached result if available and not expired
 * @private
 */
function getCachedResult(key) {
  if (calculationCache.has(key)) {
    const cached = calculationCache.get(key);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.debug('Cache hit for calculation', { key });
      return cached.value;
    }
    // Remove expired entry
    calculationCache.delete(key);
  }
  return null;
}

/**
 * Store result in cache
 * @private
 */
function setCachedResult(key, value) {
  // Limit cache size
  if (calculationCache.size >= CACHE_MAX_SIZE) {
    const firstKey = calculationCache.keys().next().value;
    calculationCache.delete(firstKey);
  }
  calculationCache.set(key, {
    value,
    timestamp: Date.now()
  });
}

/**
 * Clear calculation cache
 */
export function clearCalculationCache() {
  calculationCache.clear();
  logger.debug('Calculation cache cleared');
}

/**
 * Calculate current medication level based on half-life decay
 * @param {Array} injections - Array of injection records
 * @param {Date} currentTime - Current time for calculation
 * @param {boolean} useCache - Whether to use memoization cache (default true)
 * @returns {number} Current medication level in mg
 */
export function calculateCurrentMedicationLevel(injections, currentTime = new Date(), useCache = true) {
  if (!injections || injections.length === 0) {
    return 0;
  }

  // Check cache if enabled
  if (useCache) {
    const cacheKey = generateCacheKey(injections, currentTime);
    const cachedResult = getCachedResult(cacheKey);
    if (cachedResult !== null) {
      return cachedResult;
    }
  }

  const HALF_LIFE_MS = APP_CONFIG.HALF_LIFE_HOURS * 60 * 60 * 1000;
  let totalLevel = 0;

  injections.forEach(injection => {
    const injectionTime = new Date(injection.timestamp);
    const timeElapsed = currentTime - injectionTime;

    if (timeElapsed >= 0) {
      // Calculate remaining medication using exponential decay: A = A0 * (1/2)^(t/t_half)
      const halfLivesPassed = timeElapsed / HALF_LIFE_MS;
      const remainingFromDose = injection.dose_mg * Math.pow(0.5, halfLivesPassed);
      totalLevel += remainingFromDose;
    }
  });

  // Store in cache if enabled
  if (useCache) {
    const cacheKey = generateCacheKey(injections, currentTime);
    setCachedResult(cacheKey, totalLevel);
  }

  logger.debug('Medication level calculated', {
    totalLevel: totalLevel.toFixed(2),
    injectionCount: injections.length
  });

  return totalLevel;
}

/**
 * Generate medication level data points over time
 * @param {Array} injections - Array of injection records
 * @param {Date} startDate - Start date for projection
 * @param {Date} endDate - End date for projection
 * @param {number} intervalHours - Hours between data points
 * @returns {Array} Array of {time, level} objects
 */
export function generateMedicationLevelData(injections, startDate, endDate, intervalHours = 24) {
  const data = [];
  const intervalMs = intervalHours * 60 * 60 * 1000;
  let currentTime = new Date(startDate);

  while (currentTime <= endDate) {
    const level = calculateCurrentMedicationLevel(injections, currentTime);
    data.push({
      time: new Date(currentTime),
      level: level
    });
    currentTime = new Date(currentTime.getTime() + intervalMs);
  }

  return data;
}

/**
 * Calculate time until medication level reaches target
 * @param {Array} injections - Array of injection records
 * @param {number} targetLevel - Target medication level in mg
 * @param {Date} startTime - Start time for calculation
 * @returns {number|null} Hours until target level, or null if never reached
 */
export function calculateTimeToTargetLevel(injections, targetLevel, startTime = new Date()) {
  const currentLevel = calculateCurrentMedicationLevel(injections, startTime);

  if (currentLevel < targetLevel) {
    return null; // Level will only decrease from now
  }

  // Binary search for the time when level drops to target
  let low = 0;
  let high = 24 * 30; // Search up to 30 days
  const tolerance = 0.01;

  while (high - low > 0.1) {
    const mid = (low + high) / 2;
    const testTime = new Date(startTime.getTime() + mid * 60 * 60 * 1000);
    const testLevel = calculateCurrentMedicationLevel(injections, testTime);

    if (Math.abs(testLevel - targetLevel) < tolerance) {
      return mid;
    }

    if (testLevel > targetLevel) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return (low + high) / 2;
}

/**
 * Calculate steady-state medication level
 * @param {number} doseMg - Dose amount in mg
 * @param {number} intervalDays - Days between doses
 * @returns {Object} {min, max, average} steady-state levels
 */
export function calculateSteadyState(doseMg, intervalDays) {
  const HALF_LIFE_DAYS = APP_CONFIG.HALF_LIFE_HOURS / 24;
  const k = Math.log(2) / HALF_LIFE_DAYS; // Elimination rate constant

  // Calculate steady-state using geometric series
  const intervalHours = intervalDays * 24;
  const ratio = Math.exp(-k * intervalDays);

  const minLevel = (doseMg * ratio) / (1 - ratio);
  const maxLevel = doseMg + minLevel;
  const averageLevel = (maxLevel + minLevel) / 2;

  return {
    min: minLevel,
    max: maxLevel,
    average: averageLevel,
    timeToSteadyState: HALF_LIFE_DAYS * 5 // Approximately 5 half-lives
  };
}

/**
 * Calculate medication level at injection time
 * @param {Array} injections - Sorted array of injection records (newest first)
 * @param {number} index - Index of injection to calculate level for
 * @returns {number} Medication level at injection time in mg
 */
export function calculateLevelAtInjection(injections, index) {
  if (index >= injections.length) {
    return 0;
  }

  const currentInjection = injections[index];
  const previousInjections = injections.slice(index + 1);

  return calculateCurrentMedicationLevel(
    previousInjections,
    new Date(currentInjection.timestamp)
  );
}