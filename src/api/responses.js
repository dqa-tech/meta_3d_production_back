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

/**
 * Format task with enhanced export information
 * @param {Object} task - Base task object
 * @returns {Object} Task with export context
 */
function formatTaskWithExportInfo(task) {
  const enhancedTask = { ...task };
  
  // Add export status context
  if (task.exportStatus) {
    enhancedTask.exportInfo = {
      status: task.exportStatus,
      batchId: task.exportBatchId || null,
      stagedCount: task.stagedCount || null,
      exportTime: task.exportTime || null,
      isStaged: task.exportStatus === EXPORT_STATUS_VALUES.STAGED,
      isDelivered: task.exportStatus === EXPORT_STATUS_VALUES.DELIVERED,
      canBeDelivered: task.exportStatus === EXPORT_STATUS_VALUES.STAGED,
      needsAttention: [
        EXPORT_STATUS_VALUES.STAGING_FAILED,
        EXPORT_STATUS_VALUES.DELIVERY_FAILED
      ].includes(task.exportStatus)
    };
  } else {
    enhancedTask.exportInfo = {
      status: null,
      batchId: null,
      stagedCount: null,
      exportTime: null,
      isStaged: false,
      isDelivered: false,
      canBeDelivered: false,
      needsAttention: false
    };
  }
  
  // Add review context if available
  if (task.reviewStatus) {
    enhancedTask.reviewInfo = {
      status: task.reviewStatus,
      score: task.reviewScore || null,
      reviewer: task.reviewerEmail || null,
      reviewTime: task.reviewTime || null,
      isPassed: task.reviewStatus === REVIEW_STATUS_VALUES.PASSED,
      isFailed: task.reviewStatus === REVIEW_STATUS_VALUES.FAILED,
      isPending: task.reviewStatus === REVIEW_STATUS_VALUES.PENDING
    };
  }
  
  return enhancedTask;
}

/**
 * Create export status response
 * @param {Object} statusData - Export status data
 * @returns {Object} Export status response
 */
function exportStatusResponse(statusData) {
  return {
    success: true,
    exportStatus: {
      systemHealth: statusData.systemHealth || { score: 100, status: 'good' },
      activeBatches: statusData.activeBatches || [],
      recentActivity: statusData.recentActivity || {},
      stagingInfo: statusData.stagingInfo || { isConfigured: false },
      recommendations: statusData.recommendations || []
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create batch status response
 * @param {string} batchId - Export batch ID
 * @param {Object} batchData - Batch status data
 * @returns {Object} Batch status response
 */
function batchStatusResponse(batchId, batchData) {
  return {
    success: true,
    batch: {
      id: batchId,
      status: batchData.overallStatus || 'unknown',
      tasks: {
        total: batchData.totalTasks || 0,
        staged: batchData.tasksCompleted || 0,
        delivering: batchData.tasksInProgress || 0,
        delivered: batchData.tasksDelivered || 0,
        failed: batchData.tasksFailed || 0
      },
      progress: {
        percentage: batchData.percentComplete || 0,
        estimatedCompletion: batchData.estimatedTimeRemaining || null
      },
      created: batchData.createdAt || null,
      lastUpdate: batchData.lastUpdate || new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Create staging validation response
 * @param {Object} validationResult - Validation result
 * @returns {Object} Validation response
 */
function stagingValidationResponse(validationResult) {
  return {
    success: validationResult.isValid,
    validation: {
      isValid: validationResult.isValid,
      taskId: validationResult.taskId,
      folderName: validationResult.folderName,
      fileCount: validationResult.fileCount,
      requiredFiles: validationResult.requiredFiles,
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || []
    },
    canProceedToStaging: validationResult.isValid && validationResult.fileCount >= 6,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create delivery validation response
 * @param {Object} validationResult - Delivery validation result
 * @returns {Object} Validation response
 */
function deliveryValidationResponse(validationResult) {
  return {
    success: validationResult.isValid,
    validation: {
      isValid: validationResult.isValid,
      exportBatchId: validationResult.exportBatchId,
      stagedTasks: validationResult.stagedTasks,
      stagingFolder: validationResult.stagingFolder,
      errors: validationResult.errors || []
    },
    canProceedToDelivery: validationResult.isValid && validationResult.stagedTasks > 0,
    timestamp: new Date().toISOString()
  };
}

/**
 * Enhance task list with export information
 * @param {Array} tasks - Array of tasks
 * @returns {Array} Enhanced tasks with export info
 */
function enhanceTasksWithExportInfo(tasks) {
  return tasks.map(task => formatTaskWithExportInfo(task));
}

/**
 * Create export operation response
 * @param {Object} operationResult - Export operation result
 * @param {string} operationType - Type of operation (staging/delivery)
 * @returns {Object} Operation response
 */
function exportOperationResponse(operationResult, operationType) {
  const response = {
    success: operationResult.success,
    operation: {
      type: operationType,
      batchId: operationResult.exportBatchId,
      duration: operationResult.duration || 0,
      stats: operationResult.stats || {},
      errors: operationResult.errors || []
    },
    timestamp: new Date().toISOString()
  };
  
  // Add operation-specific details
  if (operationType === 'staging') {
    response.operation.stagingFolder = operationResult.batchFolder || null;
    response.operation.exportSheet = operationResult.exportSheet || null;
  } else if (operationType === 'delivery') {
    response.operation.deliveryFolder = operationResult.deliveryFolder || null;
    response.operation.clientFolder = operationResult.clientFolder || null;
  }
  
  return response;
}