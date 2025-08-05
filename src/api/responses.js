/**
 * API response handling
 * Standardized response formatting
 */

/**
 * Create success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Formatted response
 */
function successResponse(data, message = 'Success') {
  return {
    success: true,
    message: message,
    data: data,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create error response
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
function errorResponse(error) {
  const response = {
    success: false,
    error: {
      message: error.message || 'An error occurred',
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    }
  };
  
  if (error instanceof ValidationError) {
    response.error.type = 'validation';
    response.error.field = error.details?.field;
  } else if (error instanceof ApiError) {
    response.error.type = 'api';
    response.error.statusCode = error.statusCode;
  } else if (error instanceof DriveError) {
    response.error.type = 'drive';
  }
  
  return response;
}

/**
 * Handle API error and return response
 * @param {Error} err - Error to handle
 * @returns {TextOutput} Error response
 */
function handleApiError(err) {
  // Log the error
  error('API error', {
    error: err.message,
    stack: err.stack,
    type: err.constructor.name
  });
  
  const response = errorResponse(err);
  let statusCode = 500;
  
  if (err instanceof ValidationError) {
    statusCode = 400;
  } else if (err instanceof ApiError) {
    statusCode = err.statusCode || 500;
  } else if (err.message.includes('not found')) {
    statusCode = 404;
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Create paginated response
 * @param {Array} items - Items to paginate
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Paginated response
 */
function paginatedResponse(items, page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    success: true,
    data: items,
    pagination: {
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Format task for API response
 * @param {Array} row - Sheet row data
 * @param {number} rowIndex - Row index in sheet
 * @param {Array} columnOrder - Column order array
 * @returns {Object} Formatted task
 */
function formatTaskResponse(row, rowIndex, columnOrder) {
  // Removed console.log to prevent stack overflow
  
  const task = {};
  
  if (!columnOrder) {
    // columnOrder is undefined
    return task;
  }
  
  columnOrder.forEach((key, index) => {
    const value = row[index];
    const fieldName = key.toLowerCase().replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    
    // Convert empty strings to null
    task[fieldName] = value === '' ? null : value;
    
    // Log first few mappings
    if (index < 3) {
      // Removed console.log
    }
  });
  
  // Add metadata
  task.sheetRow = rowIndex;
  
  // Clean up response
  delete task.sheetRow; // Internal use only
  
  // Return formatted task
  return task;
}

/**
 * Create batch response
 * @param {Array} results - Batch operation results
 * @returns {Object} Batch response
 */
function batchResponse(results) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  return {
    success: failed.length === 0,
    results: results,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: Math.round((successful.length / results.length) * 100) + '%'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create webhook response
 * @param {boolean} success - Whether webhook was successful
 * @param {string} message - Response message
 * @returns {Object} Webhook response
 */
function webhookResponse(success, message) {
  return {
    success: success,
    message: message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Add CORS headers to response
 * @param {TextOutput} output - Response output
 * @param {Object} request - Original request
 * @returns {TextOutput} Output with headers
 */
function addCorsHeaders(output, request) {
  const headers = createCorsHeaders(request);
  
  Object.entries(headers).forEach(([key, value]) => {
    output.addHeader(key, value);
  });
  
  return output;
}