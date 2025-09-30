/**
 * Structured Logging System
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

class Logger {
  constructor(config = {}) {
    this.level = config.level || LOG_LEVELS.INFO;
    this.enableConsole = config.enableConsole !== false;
    this.enableRemote = config.enableRemote || false;
    this.remoteEndpoint = config.remoteEndpoint || null;
    this.logs = [];
    this.maxLogs = config.maxLogs || 1000;
  }

  /**
   * Log a debug message
   * @param {string} message - Log message
   * @param {*} meta - Additional metadata
   */
  debug(message, meta = {}) {
    this._log(LOG_LEVELS.DEBUG, message, meta);
  }

  /**
   * Log an info message
   * @param {string} message - Log message
   * @param {*} meta - Additional metadata
   */
  info(message, meta = {}) {
    this._log(LOG_LEVELS.INFO, message, meta);
  }

  /**
   * Log a warning message
   * @param {string} message - Log message
   * @param {*} meta - Additional metadata
   */
  warn(message, meta = {}) {
    this._log(LOG_LEVELS.WARN, message, meta);
  }

  /**
   * Log an error message
   * @param {string} message - Log message
   * @param {*} meta - Additional metadata
   */
  error(message, meta = {}) {
    this._log(LOG_LEVELS.ERROR, message, meta);
  }

  /**
   * Log a fatal error message
   * @param {string} message - Log message
   * @param {*} meta - Additional metadata
   */
  fatal(message, meta = {}) {
    this._log(LOG_LEVELS.FATAL, message, meta);
  }

  /**
   * Internal logging function
   * @private
   */
  _log(level, message, meta) {
    if (level < this.level) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level: this._getLevelName(level),
      message,
      meta,
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Store in memory
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    if (this.enableConsole) {
      this._logToConsole(level, logEntry);
    }

    // Remote logging
    if (this.enableRemote && this.remoteEndpoint) {
      this._logToRemote(logEntry);
    }
  }

  /**
   * Get level name from level number
   * @private
   */
  _getLevelName(level) {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
  }

  /**
   * Log to browser console
   * @private
   */
  _logToConsole(level, logEntry) {
    const { timestamp, level: levelName, message, meta } = logEntry;
    const formatted = `[${timestamp}] ${levelName}: ${message}`;

    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(formatted, meta);
        break;
      case LOG_LEVELS.INFO:
        console.info(formatted, meta);
        break;
      case LOG_LEVELS.WARN:
        console.warn(formatted, meta);
        break;
      case LOG_LEVELS.ERROR:
      case LOG_LEVELS.FATAL:
        console.error(formatted, meta);
        break;
    }
  }

  /**
   * Send logs to remote endpoint
   * @private
   */
  async _logToRemote(logEntry) {
    try {
      await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
    } catch (error) {
      // Silently fail to avoid infinite logging loop
      console.error('Failed to send log to remote endpoint:', error);
    }
  }

  /**
   * Get all stored logs
   * @returns {Array} Log entries
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear stored logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   * @returns {string} JSON string of logs
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Set log level
   * @param {string} levelName - Level name (DEBUG, INFO, WARN, ERROR, FATAL)
   */
  setLevel(levelName) {
    const level = LOG_LEVELS[levelName.toUpperCase()];
    if (level !== undefined) {
      this.level = level;
    }
  }
}

// Create singleton instance
const logger = new Logger({
  level: LOG_LEVELS.INFO,
  enableConsole: true,
  enableRemote: false
});

export default logger;
export { Logger, LOG_LEVELS };