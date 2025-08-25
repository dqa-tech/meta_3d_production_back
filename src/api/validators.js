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
  
  // Duration validation and normalization
  if (data.timeTaken !== undefined) {
    data.timeTaken = validateAndFormatDuration(data.timeTaken);
  }
  
  // File ID validation
  if (data.objFileId && !isValidDriveFileId(data.objFileId)) {
    throw new ValidationError('Invalid Drive file ID', 'objFileId', data.objFileId);
  }
  
  if (data.alignmentFileId && !isValidDriveFileId(data.alignmentFileId)) {
    throw new ValidationError('Invalid Drive file ID', 'alignmentFileId', data.alignmentFileId);
  }
  
  if (data.videoFileId) {
    // videoFileId must always be an array
    if (!Array.isArray(data.videoFileId)) {
      throw new ValidationError('videoFileId must be an array', 'videoFileId', data.videoFileId);
    }
    
    // Validate each ID in the array
    data.videoFileId.forEach((id, index) => {
      if (!isValidDriveFileId(id)) {
        throw new ValidationError(
          `Invalid Drive file ID at index ${index}`, 
          'videoFileId', 
          id
        );
      }
    });
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

/**
 * Validate rework request
 * @param {Object} data - Rework request data
 * @throws {ValidationError} If validation fails
 */
function validateReworkRequest(data) {
  // Email validation for requestedBy
  if (data.requestedBy && !isValidEmail(data.requestedBy)) {
    throw new ValidationError('Invalid requestedBy email format', 'requestedBy', data.requestedBy);
  }
  
  // Reason length validation
  if (data.reason && data.reason.length > 500) {
    throw new ValidationError('Reason cannot exceed 500 characters', 'reason', data.reason);
  }
  
  // Validate revision count if provided
  if (data.revisionCount !== undefined) {
    const count = parseInt(data.revisionCount);
    if (isNaN(count) || count < 0 || count > 10) {
      throw new ValidationError('Revision count must be between 0 and 10', 'revisionCount', data.revisionCount);
    }
  }
}

/**
 * Validate revision history format
 * @param {string} historyJson - JSON string of revision history
 * @returns {boolean} True if valid
 */
function isValidRevisionHistory(historyJson) {
  try {
    const history = JSON.parse(historyJson);
    if (!Array.isArray(history)) {
      return false;
    }
    
    // Validate each revision entry
    for (const revision of history) {
      if (!revision.revision || !revision.agentEmail || !revision.completedAt) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate review request
 * @param {Object} data - Review request data
 * @throws {ValidationError} If validation fails
 */
function validateReviewRequest(data) {
  // Score validation
  if (data.score === undefined || data.score === null) {
    throw new ValidationError('score is required', 'score', data.score);
  }
  
  const score = parseFloat(data.score);
  if (isNaN(score) || score < 0 || score > 100) {
    throw new ValidationError('score must be a number between 0 and 100', 'score', data.score);
  }
  
  // Reviewer email validation
  if (!data.reviewerEmail || !isValidEmail(data.reviewerEmail)) {
    throw new ValidationError('Valid reviewerEmail is required', 'reviewerEmail', data.reviewerEmail);
  }
  
  // Task ID validation
  if (!data.taskId || typeof data.taskId !== 'string' || data.taskId.trim() === '') {
    throw new ValidationError('taskId is required', 'taskId', data.taskId);
  }
}

/**
 * Validate and format duration string
 * @param {string} duration - Duration string to validate and format
 * @returns {string} Normalized duration in HH:MM:SS format
 * @throws {ValidationError} If validation fails
 */
function validateAndFormatDuration(duration) {
  if (!duration || typeof duration !== 'string') {
    throw new ValidationError('timeTaken must be a string', 'timeTaken', duration);
  }
  
  // Remove any whitespace
  const trimmed = duration.trim();
  
  // Match HH:MM:SS or MM:SS formats
  const hhmmssPattern = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;
  const mmssPattern = /^([0-5]?\d):([0-5]\d)$/;
  
  let hours, minutes, seconds;
  
  if (hhmmssPattern.test(trimmed)) {
    // HH:MM:SS format
    const match = trimmed.match(hhmmssPattern);
    hours = parseInt(match[1]);
    minutes = parseInt(match[2]);
    seconds = parseInt(match[3]);
  } else if (mmssPattern.test(trimmed)) {
    // MM:SS format - treat as 0:MM:SS
    const match = trimmed.match(mmssPattern);
    hours = 0;
    minutes = parseInt(match[1]);
    seconds = parseInt(match[2]);
  } else {
    throw new ValidationError(
      'timeTaken must be in HH:MM:SS or MM:SS format (e.g., "1:30:45" or "45:30")',
      'timeTaken',
      duration
    );
  }
  
  // Validate ranges
  if (hours > 99) {
    throw new ValidationError('Duration hours cannot exceed 99', 'timeTaken', duration);
  }
  
  if (minutes > 59) {
    throw new ValidationError('Duration minutes cannot exceed 59', 'timeTaken', duration);
  }
  
  if (seconds > 59) {
    throw new ValidationError('Duration seconds cannot exceed 59', 'timeTaken', duration);
  }
  
  // Format to HH:MM:SS with zero padding
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}