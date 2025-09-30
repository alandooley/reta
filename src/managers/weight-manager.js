/**
 * Weight Management Module
 * Handles weight tracking and BMI calculations
 */

import { kgToLbs, lbsToKg } from '../utils/utils.js';
import logger from '../utils/logger.js';

/**
 * Add a new weight measurement
 * @param {Object} weight - Weight data
 * @param {number} weight.weight_kg - Weight in kilograms
 * @param {string} [weight.timestamp] - ISO timestamp (defaults to now)
 * @param {string} [weight.source] - Source of weight data ('manual', 'scale', 'api')
 * @param {number} [weight.bmi] - Body Mass Index
 * @param {number} [weight.body_fat_percentage] - Body fat percentage
 * @returns {Object} New weight record
 * @throws {Error} If required fields are missing or invalid
 */
export function addWeight(weight) {
  // Validate required fields
  if (!weight) {
    const error = new Error('Weight data is required');
    logger.error('addWeight failed: Missing weight data');
    throw error;
  }

  if (!weight.weight_kg || weight.weight_kg <= 0) {
    const error = new Error('Valid weight_kg is required');
    logger.error('addWeight failed: Invalid weight_kg', { weight_kg: weight.weight_kg });
    throw error;
  }

  // Validate weight is within reasonable range (20-500 kg)
  const weightKg = parseFloat(weight.weight_kg);
  if (weightKg < 20 || weightKg > 500) {
    const error = new Error('Weight must be between 20 and 500 kg');
    logger.error('addWeight failed: Weight out of range', { weight_kg: weightKg });
    throw error;
  }

  try {
    const newWeight = {
      timestamp: weight.timestamp || new Date().toISOString(),
      weight_kg: weightKg,
      weight_lbs: kgToLbs(weightKg),
      source: weight.source || 'manual',
      bmi: weight.bmi ? parseFloat(weight.bmi) : null,
      body_fat_percentage: weight.body_fat_percentage ? parseFloat(weight.body_fat_percentage) : null
    };

    logger.info('Weight measurement added successfully', {
      timestamp: newWeight.timestamp,
      weight_kg: newWeight.weight_kg.toFixed(1),
      weight_lbs: newWeight.weight_lbs.toFixed(1),
      source: newWeight.source
    });

    return newWeight;
  } catch (error) {
    logger.error('Failed to add weight measurement', {
      error: error.message,
      weight
    });
    throw error;
  }
}

/**
 * Calculate BMI (Body Mass Index)
 * @param {number} weightKg - Weight in kilograms
 * @param {number} heightCm - Height in centimeters
 * @returns {number} BMI value
 */
export function calculateBMI(weightKg, heightCm) {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    logger.warn('calculateBMI called with invalid parameters', { weightKg, heightCm });
    return null;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  logger.debug('BMI calculated', {
    weight_kg: weightKg,
    height_cm: heightCm,
    bmi: bmi.toFixed(1)
  });

  return bmi;
}

/**
 * Get BMI category
 * @param {number} bmi - BMI value
 * @returns {string} BMI category
 */
export function getBMICategory(bmi) {
  if (!bmi || bmi <= 0) {
    return 'Unknown';
  }

  if (bmi < 18.5) {
    return 'Underweight';
  } else if (bmi < 25) {
    return 'Normal weight';
  } else if (bmi < 30) {
    return 'Overweight';
  } else if (bmi < 35) {
    return 'Obese (Class I)';
  } else if (bmi < 40) {
    return 'Obese (Class II)';
  } else {
    return 'Obese (Class III)';
  }
}

/**
 * Sort weights by timestamp (newest first)
 * @param {Array} weights - Array of weight records
 * @returns {Array} Sorted array
 */
export function sortWeights(weights) {
  if (!Array.isArray(weights)) {
    logger.warn('sortWeights called with non-array', { type: typeof weights });
    return [];
  }

  return weights.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );
}

/**
 * Get most recent weight measurement
 * @param {Array} weights - Array of weight records
 * @returns {Object|null} Most recent weight or null
 */
export function getMostRecentWeight(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return null;
  }

  const sorted = sortWeights([...weights]);
  return sorted[0];
}

/**
 * Calculate weight change between two measurements
 * @param {Object} startWeight - Earlier weight measurement
 * @param {Object} endWeight - Later weight measurement
 * @returns {Object} {kg, lbs, percentage} weight change
 */
export function calculateWeightChange(startWeight, endWeight) {
  if (!startWeight || !endWeight) {
    logger.warn('calculateWeightChange called with invalid weights', {
      startWeight,
      endWeight
    });
    return { kg: 0, lbs: 0, percentage: 0 };
  }

  const changeKg = endWeight.weight_kg - startWeight.weight_kg;
  const changeLbs = kgToLbs(Math.abs(changeKg)) * (changeKg >= 0 ? 1 : -1);
  const percentage = (changeKg / startWeight.weight_kg) * 100;

  logger.debug('Weight change calculated', {
    start_kg: startWeight.weight_kg,
    end_kg: endWeight.weight_kg,
    change_kg: changeKg.toFixed(1),
    percentage: percentage.toFixed(1)
  });

  return {
    kg: changeKg,
    lbs: changeLbs,
    percentage: percentage
  };
}

/**
 * Get weight measurements within a date range
 * @param {Array} weights - Array of weight records
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered weight records
 */
export function getWeightsInRange(weights, startDate, endDate) {
  if (!Array.isArray(weights)) {
    return [];
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  return weights.filter(weight => {
    const weightDate = new Date(weight.timestamp);
    return weightDate >= start && weightDate <= end;
  });
}

/**
 * Calculate average weight over a period
 * @param {Array} weights - Array of weight records
 * @param {number} [days] - Number of days to average (default 30)
 * @returns {number|null} Average weight in kg or null
 */
export function calculateAverageWeight(weights, days = 30) {
  if (!Array.isArray(weights) || weights.length === 0) {
    return null;
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const recentWeights = getWeightsInRange(weights, startDate, now);

  if (recentWeights.length === 0) {
    return null;
  }

  const sum = recentWeights.reduce((acc, w) => acc + w.weight_kg, 0);
  const average = sum / recentWeights.length;

  logger.debug('Average weight calculated', {
    days,
    count: recentWeights.length,
    average: average.toFixed(1)
  });

  return average;
}

/**
 * Get weight trend (gaining, losing, stable)
 * @param {Array} weights - Array of weight records (sorted newest first)
 * @param {number} [threshold] - Percentage threshold for stable (default 1%)
 * @returns {string} 'gaining', 'losing', 'stable', or 'unknown'
 */
export function getWeightTrend(weights, threshold = 1) {
  if (!Array.isArray(weights) || weights.length < 2) {
    return 'unknown';
  }

  const sorted = sortWeights([...weights]);
  const recent = sorted[0];
  const older = sorted[Math.min(sorted.length - 1, 4)]; // Compare with up to 5th most recent

  const change = calculateWeightChange(older, recent);

  if (Math.abs(change.percentage) < threshold) {
    return 'stable';
  }

  return change.kg > 0 ? 'gaining' : 'losing';
}