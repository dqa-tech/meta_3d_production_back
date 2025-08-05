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
      '/api/tasks/batch': batchUpdateTasks
    },
    'GET': {
      '/api/task': getTask,
      '/api/tasks': getTasks,
      '/api/status': getApiStatus,
      '/api/agent/groups': getAgentGroupsEndpoint
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
    'objFileId', 'alignmentFileId', 'videoFileId'
  ];
  
  // Extract allowed fields
  allowedFields.forEach(field => {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  });
  
  // Convert file IDs to URLs
  if (updates.objFileId) {
    updates.objLink = `https://drive.google.com/file/d/${updates.objFileId}/view`;
  }
  if (updates.alignmentFileId) {
    updates.alignmentLink = `https://drive.google.com/file/d/${updates.alignmentFileId}/view`;
  }
  if (updates.videoFileId) {
    updates.videoLink = `https://drive.google.com/file/d/${updates.videoFileId}/view`;
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
  
  const tasks = queryTasks(filters);
  
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
      'POST /api/tasks/batch',
      'GET /api/task',
      'GET /api/tasks',
      'GET /api/status',
      'GET /api/agent/groups'
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