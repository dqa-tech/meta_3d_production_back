/**
 * REST API endpoints for production tool integration
 * Handles external requests from the 3D production tool
 */

/**
 * Main entry point for Web App
 * @param {Object} e - Event object from request
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    const request = parseRequest(e);
    const response = routeRequest(request);
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Handle GET requests
 * @param {Object} e - Event object from request
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  try {
    const request = {
      method: 'GET',
      path: e.parameter.path || '',
      params: e.parameter,
      headers: {}
    };
    
    const response = routeRequest(request);
    
    return ContentService
      .createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Parse incoming request
 * @param {Object} e - Event object
 * @returns {Object} Parsed request
 */
function parseRequest(e) {
  const contentType = e.parameter.contentType || 'application/json';
  let body = {};
  
  if (e.postData && e.postData.contents) {
    if (contentType.includes('application/json')) {
      body = JSON.parse(e.postData.contents);
    } else {
      body = e.postData.contents;
    }
  }
  
  return {
    method: e.parameter.method || 'POST',
    path: e.parameter.path || body.path || '',
    params: e.parameter,
    body: body,
    headers: e.parameter.headers || {}
  };
}

/**
 * Route request to appropriate handler
 * @param {Object} request - Parsed request
 * @returns {Object} Response object
 */
function routeRequest(request) {
  const routes = {
    'POST': {
      '/api/task/update': updateTask,
      '/api/task/assign': assignTask,
      '/api/task/rework': reworkTask,
      '/api/task/review': reviewTask,
      '/api/tasks/batch': batchUpdateTasks
    },
    'GET': {
      '/api/task': getTask,
      '/api/tasks': getTasks,
      '/api/status': getApiStatus,
      '/api/agent/groups': getAgentGroupsEndpoint,
      '/api/agent/history': getAgentHistory
    }
  };
  
  const handler = routes[request.method]?.[request.path];
  
  if (!handler) {
    throw new ApiError(`Endpoint not found: ${request.method} ${request.path}`, 404);
  }
  
  // Validate API key
  validateApiKey(request);
  
  return handler(request);
}

/**
 * Update task endpoint
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function updateTask(request) {
  const data = request.body;
  
  validateRequired(data, ['taskId']);
  
  const updates = {};
  const allowedFields = [
    'agentEmail', 'status', 'startTime', 'endTime',
    'objFileId', 'alignmentFileId', 'videoFileId', 'timeTaken',
    'reviewStatus', 'reviewScore', 'reviewerEmail', 'reviewTime'
  ];
  
  // Extract allowed fields
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  });
  
  // Handle review status when task is completed
  if (updates.status === STATUS_VALUES.COMPLETE) {
    const currentTask = getTaskById(data.taskId);
    
    if (currentTask && 
        currentTask.reviewerEmail && 
        currentTask.reviewStatus === REVIEW_STATUS_VALUES.FAILED &&
        (updates.agentEmail === currentTask.reviewerEmail || 
         data.agentEmail === currentTask.reviewerEmail)) {
      
      // Auto-pass if reviewer completes their own rework
      updates.reviewStatus = REVIEW_STATUS_VALUES.PASSED;
      // Do NOT update reviewTime - task wasn't actually reviewed
      // Keep existing reviewScore and reviewerEmail
    } else if (!currentTask || !currentTask.reviewStatus || currentTask.status === STATUS_VALUES.REWORK) {
      
      // Set to pending review for first completion OR rework completion
      updates.reviewStatus = REVIEW_STATUS_VALUES.PENDING;
    }
  }
  
  // Convert file IDs to URLs
  if (updates.objFileId) {
    updates.objLink = `https://drive.google.com/file/d/${updates.objFileId}/view`;
  }
  if (updates.alignmentFileId) {
    updates.alignmentLink = `https://drive.google.com/file/d/${updates.alignmentFileId}/view`;
  }
  if (updates.videoFileId) {
    // videoFileId is always an array (even for single videos)
    const videoUrls = updates.videoFileId.map(id => 
      `https://drive.google.com/file/d/${id}/view`
    );
    updates.videoLink = videoUrls.join(',');
  }
  
  const result = updateTaskRecord(data.taskId, updates);
  
  return {
    success: true,
    task: result,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get single task
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function getTask(request) {
  const taskId = request.params.taskId;
  
  if (!taskId) {
    throw new ApiError('taskId parameter required', 400);
  }
  
  const task = getTaskById(taskId);
  
  if (!task) {
    throw new ApiError('Task not found', 404);
  }
  
  return {
    success: true,
    task: task,
    timestamp: new Date().toISOString()
  };
}

/**
 * Get multiple tasks with filters
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function getTasks(request) {
  const filters = {
    batchId: request.params.batchId,
    status: request.params.status,
    agentEmail: request.params.agentEmail,
    startDate: request.params.startDate,
    endDate: request.params.endDate,
    limit: parseInt(request.params.limit) || 100,
    offset: parseInt(request.params.offset) || 0
  };
  
  let tasks = queryTasks(filters);
  
  // Apply field selection if requested
  if (request.params.fields) {
    const requestedFields = request.params.fields.split(',').map(f => f.trim());
    tasks = tasks.map(task => {
      const filteredTask = {};
      requestedFields.forEach(field => {
        if (task.hasOwnProperty(field)) {
          filteredTask[field] = task[field];
        }
      });
      return filteredTask;
    });
  }
  
  // Include revision history if requested
  if (request.params.includeHistory === 'true' && !request.params.fields) {
    tasks = tasks.map(task => {
      if (task.revisionHistory) {
        try {
          task.revisionHistoryParsed = JSON.parse(task.revisionHistory);
        } catch (e) {
          task.revisionHistoryParsed = [];
        }
      }
      return task;
    });
  }
  
  return {
    success: true,
    tasks: tasks,
    count: tasks.length,
    filters: filters,
    timestamp: new Date().toISOString()
  };
}

/**
 * Assign task to agent
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function assignTask(request) {
  const data = request.body;
  
  validateRequired(data, ['taskId', 'agentEmail']);
  
  // Fetch current task state to check if it's already assigned
  const currentTask = getTaskById(data.taskId);
  
  if (!currentTask) {
    throw new ApiError(`Task not found: ${data.taskId}`, 404);
  }
  
  // Check if task is already in progress
  if (currentTask.status === STATUS_VALUES.IN_PROGRESS) {
    throw new ApiError(
      `Task already assigned to ${currentTask.agentEmail}`,
      409  // HTTP Conflict status
    );
  }
  
  // Check if task is already complete
  if (currentTask.status === STATUS_VALUES.COMPLETE) {
    throw new ApiError('Cannot assign completed task', 400);
  }
  
  // Check if task is flagged
  if (currentTask.status === STATUS_VALUES.FLAGGED) {
    throw new ApiError('Cannot assign flagged task - requires review first', 400);
  }
  
  // Task must be OPEN or REWORK to be assigned
  if (currentTask.status !== STATUS_VALUES.OPEN && 
      currentTask.status !== STATUS_VALUES.REWORK) {
    throw new ApiError(
      `Cannot assign task with status: ${currentTask.status}`, 
      400
    );
  }
  
  // Proceed with assignment for OPEN tasks
  const updates = {
    agentEmail: data.agentEmail,
    status: STATUS_VALUES.IN_PROGRESS,
    startTime: new Date().toISOString()
  };
  
  const result = updateTaskRecord(data.taskId, updates);
  
  return {
    success: true,
    task: result,
    message: `Task assigned to ${data.agentEmail}`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Rework task endpoint
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function reworkTask(request) {
  const data = request.body;
  
  validateRequired(data, ['taskId', 'requestedBy']);
  validateReworkRequest(data);
  
  // Fetch current task
  const currentTask = getTaskById(data.taskId);
  
  if (!currentTask) {
    throw new ApiError(`Task not found: ${data.taskId}`, 404);
  }
  
  // Only completed tasks can be marked for rework
  if (currentTask.status !== STATUS_VALUES.COMPLETE) {
    throw new ApiError(
      `Only completed tasks can be marked for rework. Current status: ${currentTask.status}`,
      400
    );
  }
  
  // Build revision history entry
  const revisionEntry = {
    revision: (currentTask.revisionCount || 0) + 1,
    agentEmail: currentTask.agentEmail,
    completedAt: currentTask.endTime,
    startedAt: currentTask.startTime,
    objLink: currentTask.objLink,
    alignmentLink: currentTask.alignmentLink,
    videoLink: currentTask.videoLink,
    timeTaken: currentTask.timeTaken,
    reason: data.reason || 'No reason provided'
  };
  
  // Parse existing history or create new array
  let revisionHistory = [];
  if (currentTask.revisionHistory) {
    try {
      revisionHistory = JSON.parse(currentTask.revisionHistory);
    } catch (e) {
      revisionHistory = [];
    }
  }
  revisionHistory.push(revisionEntry);
  
  // Update task for rework - requester becomes the owner
  const updates = {
    status: STATUS_VALUES.REWORK,
    revisionCount: (currentTask.revisionCount || 0) + 1,
    revisionHistory: JSON.stringify(revisionHistory),
    previousAgentEmail: currentTask.agentEmail,
    // The person requesting rework takes ownership
    agentEmail: data.requestedBy,
    startTime: new Date().toISOString(),  // Rework starts now
    // Clear completion data but keep assignment
    endTime: '',
    objLink: '',
    alignmentLink: '',
    videoLink: ''
  };
  
  // Store original completion time if this is first rework
  if (!currentTask.originalCompletionTime && currentTask.endTime) {
    updates.originalCompletionTime = currentTask.endTime;
  }
  
  const result = updateTaskRecord(data.taskId, updates);
  
  return {
    success: true,
    task: result,
    message: `Task marked for rework (revision ${updates.revisionCount})`,
    timestamp: new Date().toISOString()
  };
}

/**
 * Batch update tasks
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function batchUpdateTasks(request) {
  const data = request.body;
  
  validateRequired(data, ['tasks']);
  
  if (!Array.isArray(data.tasks)) {
    throw new ApiError('tasks must be an array', 400);
  }
  
  const results = data.tasks.map(taskUpdate => {
    try {
      const result = updateTaskRecord(taskUpdate.taskId, taskUpdate);
      return {
        taskId: taskUpdate.taskId,
        success: true,
        task: result
      };
    } catch (error) {
      return {
        taskId: taskUpdate.taskId,
        success: false,
        error: error.message
      };
    }
  });
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return {
    success: failed === 0,
    results: results,
    summary: {
      total: results.length,
      successful: successful,
      failed: failed
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Get API status
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function getApiStatus(request) {
  return {
    success: true,
    status: 'operational',
    version: '1.0.0',
    endpoints: [
      'POST /api/task/update',
      'POST /api/task/assign',
      'POST /api/task/rework',
      'POST /api/tasks/batch',
      'GET /api/task',
      'GET /api/tasks',
      'GET /api/status',
      'GET /api/agent/groups',
      'GET /api/agent/history'
    ],
    timestamp: new Date().toISOString()
  };
}

/**
 * Get agent groups endpoint
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function getAgentGroupsEndpoint(request) {
  const email = request.params.email;
  
  if (!email) {
    throw new ApiError('email parameter required', 400);
  }
  
  // Initialize agents sheet if needed
  initializeAgentsSheet();
  
  const groups = getAgentGroups(email);
  
  return {
    success: true,
    agentEmail: email,
    groups: groups,
    timestamp: new Date().toISOString()
  };
}

/**
 * Review task endpoint
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function reviewTask(request) {
  const data = request.body;
  
  validateRequired(data, ['taskId', 'score', 'reviewerEmail']);
  validateReviewRequest(data);
  
  // Fetch current task
  const currentTask = getTaskById(data.taskId);
  
  if (!currentTask) {
    throw new ApiError(`Task not found: ${data.taskId}`, 404);
  }
  
  // Only completed tasks can be reviewed
  if (currentTask.status !== STATUS_VALUES.COMPLETE) {
    throw new ApiError(
      `Only completed tasks can be reviewed. Current status: ${currentTask.status}`,
      400
    );
  }
  
  // Only allow review if status is pending
  if (!currentTask.reviewStatus || currentTask.reviewStatus !== REVIEW_STATUS_VALUES.PENDING) {
    throw new ApiError('Task must have pending review status to be reviewed', 400);
  }
  
  // Get threshold and determine pass/fail
  const threshold = getReviewThreshold();
  const score = parseFloat(data.score);
  const passed = score >= threshold;
  
  const reviewTime = new Date().toISOString();
  
  if (passed) {
    // Pass: Just update review fields
    const updates = {
      reviewStatus: REVIEW_STATUS_VALUES.PASSED,
      reviewScore: score,
      reviewerEmail: data.reviewerEmail,
      reviewTime: reviewTime
    };
    
    const result = updateTaskRecord(data.taskId, updates);
    
    return {
      success: true,
      task: result,
      message: `Task passed review with score ${score}`,
      timestamp: new Date().toISOString()
    };
  } else {
    // Fail: Trigger rework assignment
    const revisionCount = currentTask.revisionCount;
    const existingRevisionHistory = currentTask.revisionHistory;
    
    // Check if this is first rework: revisionCount is 0/null/empty AND revisionHistory is null/empty
    const isFirstRework = (!revisionCount || revisionCount === 0) && (!existingRevisionHistory || existingRevisionHistory.trim() === '');
    
    // Determine who gets the rework
    const reworkAssignee = isFirstRework ? currentTask.agentEmail : data.reviewerEmail;
    
    // Build revision history entry
    const revisionEntry = {
      revision: isFirstRework ? 1 : (parseInt(revisionCount) + 1),
      agentEmail: currentTask.agentEmail,
      completedAt: currentTask.endTime,
      startedAt: currentTask.startTime,
      objLink: currentTask.objLink,
      alignmentLink: currentTask.alignmentLink,
      videoLink: currentTask.videoLink,
      timeTaken: currentTask.timeTaken,
      reviewScore: score,
      reviewedBy: data.reviewerEmail,
      reviewedAt: reviewTime,
      reason: `Failed review with score ${score} (threshold: ${threshold})`
    };
    
    // Parse existing history or create new array
    let revisionHistory = [];
    if (currentTask.revisionHistory) {
      try {
        revisionHistory = JSON.parse(currentTask.revisionHistory);
      } catch (e) {
        revisionHistory = [];
      }
    }
    revisionHistory.push(revisionEntry);
    
    // Update task for rework
    const updates = {
      status: STATUS_VALUES.REWORK,
      revisionCount: isFirstRework ? 1 : (parseInt(revisionCount) + 1),
      revisionHistory: JSON.stringify(revisionHistory),
      previousAgentEmail: currentTask.agentEmail,
      agentEmail: reworkAssignee,
      startTime: reviewTime,
      // Clear completion data
      endTime: '',
      objLink: '',
      alignmentLink: '',
      videoLink: '',
      // Set review data
      reviewStatus: REVIEW_STATUS_VALUES.FAILED,
      reviewScore: score,
      reviewerEmail: data.reviewerEmail,
      reviewTime: reviewTime
    };
    
    // Store original completion time if this is first rework
    if (isFirstRework && currentTask.endTime) {
      updates.originalCompletionTime = currentTask.endTime;
    }
    
    const result = updateTaskRecord(data.taskId, updates);
    
    return {
      success: true,
      task: result,
      message: `Task failed review (score ${score}), assigned for rework to ${reworkAssignee}`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Get agent history endpoint
 * @param {Object} request - Request object
 * @returns {Object} Response
 */
function getAgentHistory(request) {
  const email = request.params.email || request.params.agentEmail;
  
  if (!email) {
    throw new ApiError('email parameter required', 400);
  }
  
  // Get all tasks for this agent
  const completedTasks = queryTasks({
    agentEmail: email,
    status: STATUS_VALUES.COMPLETE
  });
  
  const inProgressTasks = queryTasks({
    agentEmail: email,
    status: STATUS_VALUES.IN_PROGRESS
  });
  
  // Get tasks that were reworked (where this agent's work was revised)
  const allTasks = queryTasks({});
  const reworkedTasks = allTasks.filter(task => {
    if (task.previousAgentEmail === email && task.status === STATUS_VALUES.REWORK) {
      return true;
    }
    // Check revision history for this agent's work
    if (task.revisionHistory) {
      try {
        const history = JSON.parse(task.revisionHistory);
        return history.some(rev => rev.agentEmail === email);
      } catch (e) {
        return false;
      }
    }
    return false;
  });
  
  // Prepare lightweight response with folder link for task context
  const formatTaskLight = (task) => ({
    taskId: task.taskId,
    folderName: task.folderName,
    productionFolderLink: task.productionFolderLink,  // Contains all source files for review
    completedAt: task.endTime,
    revisionCount: task.revisionCount || 0,
    status: task.status
  });
  
  return {
    success: true,
    agent: email,
    summary: {
      totalCompleted: completedTasks.length,
      totalReworked: reworkedTasks.length,
      currentlyWorking: inProgressTasks.length
    },
    completedTasks: completedTasks.map(formatTaskLight),
    reworkedTasks: reworkedTasks.map(formatTaskLight),
    inProgressTasks: inProgressTasks.map(formatTaskLight),
    timestamp: new Date().toISOString()
  };
}