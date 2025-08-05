/**
 * Error handling utilities
 * Custom error types and error handling helpers
 */

/**
 * Base custom error class
 */
class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

/**
 * Drive API error
 */
class DriveError extends AppError {
  constructor(message, operation = null, fileId = null) {
    super(message, 'DRIVE_ERROR', { operation, fileId });
    this.name = 'DriveError';
  }
}

/**
 * Sheet operation error
 */
class SheetError extends AppError {
  constructor(message, operation = null, range = null) {
    super(message, 'SHEET_ERROR', { operation, range });
    this.name = 'SheetError';
  }
}

/**
 * API error
 */
class ApiError extends AppError {
  constructor(message, statusCode = 500, endpoint = null) {
    super(message, 'API_ERROR', { statusCode, endpoint });
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Handle errors consistently
 * @param {Function} func - Function to wrap
 * @returns {Function} Wrapped function
 */
function withErrorHandling(func) {
  return function(...args) {
    try {
      return func.apply(this, args);
    } catch (error) {
      handleError(error);
    }
  };
}

/**
 * Handle error and show user message
 * @param {Error} error - Error to handle
 * @param {boolean} showAlert - Whether to show alert to user
 */
function handleError(error, showAlert = true) {
  // Log the error
  let errorDetails;
  try {
    if (error instanceof AppError) {
      errorDetails = error.toJSON();
    } else {
      errorDetails = {
        message: error.message || error.toString(),
        name: error.name || 'Error'
      };
      // Only include stack if it's a string and not too long
      if (error.stack && typeof error.stack === 'string' && error.stack.length < 1000) {
        errorDetails.stack = error.stack;
      }
    }
  } catch (e) {
    // Fallback if even the error object is problematic
    errorDetails = {
      message: 'Error occurred but could not be processed',
      originalError: String(error)
    };
  }
  
  logger.error('Operation failed', errorDetails);
  
  // Show user-friendly message
  if (showAlert) {
    const ui = SpreadsheetApp.getUi();
    let message = 'An error occurred';
    
    if (error instanceof ValidationError) {
      message = `Validation Error: ${error.message}`;
    } else if (error instanceof DriveError) {
      message = `Drive Error: ${error.message}`;
    } else if (error instanceof SheetError) {
      message = `Sheet Error: ${error.message}`;
    } else if (error instanceof ApiError) {
      message = `API Error: ${error.message}`;
    } else {
      message = `Error: ${error.message || error.toString()}`;
    }
    
    ui.alert('Error', message, ui.ButtonSet.OK);
  }
  
  throw error;
}

/**
 * Assert condition or throw error
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if condition fails
 * @param {string} errorType - Error type to throw
 */
function assert(condition, message, errorType = 'ValidationError') {
  if (!condition) {
    switch (errorType) {
      case 'ValidationError':
        throw new ValidationError(message);
      case 'DriveError':
        throw new DriveError(message);
      case 'SheetError':
        throw new SheetError(message);
      case 'ApiError':
        throw new ApiError(message);
      default:
        throw new AppError(message);
    }
  }
}

/**
 * Validate required fields
 * @param {Object} data - Data object to validate
 * @param {Array<string>} requiredFields - Required field names
 */
function validateRequired(data, requiredFields) {
  for (const field of requiredFields) {
    if (!data[field]) {
      throw new ValidationError(`${field} is required`, field);
    }
  }
}

/**
 * Safe JSON parse
 * @param {string} json - JSON string to parse
 * @param {*} defaultValue - Default value if parse fails
 * @returns {*} Parsed value or default
 */
function safeJsonParse(json, defaultValue = null) {
  try {
    return JSON.parse(json);
  } catch (error) {
    return defaultValue;
  }
}