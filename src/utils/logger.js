/**
 * Logging utility
 * Centralized logging with levels and persistence
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const LOG_SHEET_NAME = '_SystemLogs';
const MAX_LOG_ENTRIES = 1000;

/**
 * Initialize logging sheet if needed
 */
function initializeLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.hideSheet();
    
    // Set headers
    const headers = ['Timestamp', 'Level', 'Message', 'Details', 'User'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  
  return sheet;
}

/**
 * Log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} details - Additional details
 */
function log(level, message, details = null) {
  try {
    const sheet = initializeLogSheet();
    const timestamp = new Date().toISOString();
    const user = Session.getActiveUser().getEmail();
    
    // Safely stringify details
    let detailsStr = '';
    if (details) {
      try {
        // Create a safe copy to avoid circular references
        const safeDetails = {};
        for (const key in details) {
          if (details.hasOwnProperty(key)) {
            const value = details[key];
            // Convert to string for primitive types and avoid complex objects
            if (value === null || value === undefined) {
              safeDetails[key] = value;
            } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              safeDetails[key] = value;
            } else {
              safeDetails[key] = String(value);
            }
          }
        }
        detailsStr = JSON.stringify(safeDetails);
      } catch (e) {
        // If JSON.stringify fails, use a simple string representation
        detailsStr = 'Error details could not be stringified';
      }
    }
    
    // Add new log entry
    sheet.appendRow([timestamp, level, message, detailsStr, user]);
    
    // Trim old entries if needed
    const rowCount = sheet.getLastRow();
    if (rowCount > MAX_LOG_ENTRIES + 1) {
      const rowsToDelete = rowCount - MAX_LOG_ENTRIES - 1;
      sheet.deleteRows(2, rowsToDelete);
    }
  } catch (err) {
    // Silently fail - we can't log an error about logging
  }
}

/**
 * Debug log
 */
function debug(message, details) {
  log('DEBUG', message, details);
}

/**
 * Info log
 */
function info(message, details) {
  log('INFO', message, details);
}

/**
 * Warning log
 */
function warn(message, details) {
  log('WARN', message, details);
}

/**
 * Error log
 */
function error(message, details) {
  log('ERROR', message, details);
}

/**
 * Log operation timing
 * @param {string} operation - Operation name
 * @param {Function} func - Function to time
 * @returns {*} Function result
 */
function timed(operation, func) {
  const start = new Date().getTime();
  try {
    const result = func();
    const duration = new Date().getTime() - start;
    info(`${operation} completed`, { duration: `${duration}ms` });
    return result;
  } catch (err) {
    const duration = new Date().getTime() - start;
    error(`${operation} failed`, { duration: `${duration}ms`, error: err.toString() });
    throw err;
  }
}

/**
 * Get recent logs
 * @param {number} count - Number of logs to retrieve
 * @param {string} levelFilter - Optional level filter
 * @returns {Array} Log entries
 */
function getRecentLogs(count = 50, levelFilter = null) {
  const sheet = initializeLogSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return [];
  
  const startRow = Math.max(2, lastRow - count + 1);
  const numRows = lastRow - startRow + 1;
  
  const logs = sheet.getRange(startRow, 1, numRows, 5).getValues();
  
  if (levelFilter) {
    return logs.filter(log => log[1] === levelFilter);
  }
  
  return logs;
}