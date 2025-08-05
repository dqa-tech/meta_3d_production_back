/**
 * API request validation
 * Validates incoming requests and data
 */

/**
 * Validate task update data
 * @param {Object} data - Update data
 * @throws {ValidationError} If validation fails
 */
function validateTaskUpdate(data) {
  // Status validation
  if (data.status && !Object.values(STATUS_VALUES).includes(data.status)) {
    throw new ValidationError(
      `Invalid status: ${data.status}. Must be one of: ${Object.values(STATUS_VALUES).join(', ')}`,
      'status',
      data.status
    );
  }
  
  // Email validation
  if (data.agentEmail && !isValidEmail(data.agentEmail)) {
    throw new ValidationError('Invalid email format', 'agentEmail', data.agentEmail);
  }
  
  // Time validation
  if (data.startTime && !isValidISODate(data.startTime)) {
    throw new ValidationError('startTime must be valid ISO date', 'startTime', data.startTime);
  }
  
  if (data.endTime && !isValidISODate(data.endTime)) {
    throw new ValidationError('endTime must be valid ISO date', 'endTime', data.endTime);
  }
  
  // Logical validation
  if (data.startTime && data.endTime) {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    
    if (end < start) {
      throw new ValidationError('endTime cannot be before startTime');
    }
  }
  
  // File ID validation
  if (data.objFileId && !isValidDriveFileId(data.objFileId)) {
    throw new ValidationError('Invalid Drive file ID', 'objFileId', data.objFileId);
  }
  
  if (data.alignmentFileId && !isValidDriveFileId(data.alignmentFileId)) {
    throw new ValidationError('Invalid Drive file ID', 'alignmentFileId', data.alignmentFileId);
  }
  
  if (data.videoFileId && !isValidDriveFileId(data.videoFileId)) {
    throw new ValidationError('Invalid Drive file ID', 'videoFileId', data.videoFileId);
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate ISO date string
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid
 */
function isValidISODate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toISOString() === dateStr;
  } catch (error) {
    return false;
  }
}

/**
 * Validate Drive file ID
 * @param {string} fileId - File ID to validate
 * @returns {boolean} True if valid format
 */
function isValidDriveFileId(fileId) {
  // Drive file IDs are alphanumeric with hyphens and underscores
  const pattern = /^[a-zA-Z0-9_-]{20,}$/;
  return pattern.test(fileId);
}

/**
 * Validate query filters
 * @param {Object} filters - Query filters
 * @throws {ValidationError} If validation fails
 */
function validateQueryFilters(filters) {
  // Validate dates
  if (filters.startDate && !isValidDateString(filters.startDate)) {
    throw new ValidationError('Invalid startDate format', 'startDate', filters.startDate);
  }
  
  if (filters.endDate && !isValidDateString(filters.endDate)) {
    throw new ValidationError('Invalid endDate format', 'endDate', filters.endDate);
  }
  
  // Validate limit and offset
  if (filters.limit !== undefined) {
    const limit = parseInt(filters.limit);
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      throw new ValidationError('Limit must be between 1 and 1000', 'limit', filters.limit);
    }
  }
  
  if (filters.offset !== undefined) {
    const offset = parseInt(filters.offset);
    if (isNaN(offset) || offset < 0) {
      throw new ValidationError('Offset must be >= 0', 'offset', filters.offset);
    }
  }
}

/**
 * Validate date string
 * @param {string} dateStr - Date string
 * @returns {boolean} True if valid
 */
function isValidDateString(dateStr) {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .substring(0, 1000); // Limit length
}

/**
 * Validate batch data
 * @param {Array} tasks - Array of task updates
 * @throws {ValidationError} If validation fails
 */
function validateBatchData(tasks) {
  if (!Array.isArray(tasks)) {
    throw new ValidationError('Tasks must be an array');
  }
  
  if (tasks.length === 0) {
    throw new ValidationError('Tasks array cannot be empty');
  }
  
  if (tasks.length > 100) {
    throw new ValidationError('Batch size cannot exceed 100 tasks');
  }
  
  // Validate each task
  tasks.forEach((task, index) => {
    try {
      if (!task.taskId) {
        throw new ValidationError('taskId is required');
      }
      validateTaskUpdate(task);
    } catch (error) {
      throw new ValidationError(`Task ${index}: ${error.message}`);
    }
  });
}