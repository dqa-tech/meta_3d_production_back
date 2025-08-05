/**
 * Sheet write operations
 * Handles writing and updating data in the tasks sheet
 */

/**
 * Update task record
 * @param {string} taskId - Task ID to update
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated task
 */
function updateTaskRecord(taskId, updates) {
  const sheet = getTasksSheet();
  const rowIndex = findTaskRowIndex(taskId);
  
  if (rowIndex === -1) {
    throw new ApiError(`Task not found: ${taskId}`, 404);
  }
  
  // Validate updates
  validateTaskUpdate(updates);
  
  // Get current row data
  const row = sheet.getRange(rowIndex, 1, 1, COLUMN_ORDER.length).getValues()[0];
  
  // Apply updates
  Object.entries(updates).forEach(([field, value]) => {
    // Convert camelCase to UPPER_SNAKE_CASE
    const columnKey = field.replace(/([A-Z])/g, '_$1').toUpperCase();
    const columnIndex = getColumnIndex(columnKey);
    
    if (columnIndex > 0) {
      row[columnIndex - 1] = value;
    }
  });
  
  // Update timestamp
  const now = new Date().toISOString();
  
  // Write back to sheet
  sheet.getRange(rowIndex, 1, 1, COLUMN_ORDER.length).setValues([row]);
  
  // Log update
  info('Task updated', {
    taskId: taskId,
    updates: Object.keys(updates),
    rowIndex: rowIndex
  });
  
  return formatTaskResponse(row, rowIndex, COLUMN_ORDER);
}

/**
 * Create new task record
 * @param {Object} taskData - Task data
 * @returns {Object} Created task
 */
function createTaskRecord(taskData) {
  const sheet = getTasksSheet();
  
  // Prepare row data
  const row = new Array(COLUMN_ORDER.length).fill('');
  
  // Set task ID if not provided
  if (!taskData.taskId) {
    taskData.taskId = generateUUID();
  }
  
  // Set import time if not provided
  if (!taskData.importTime) {
    taskData.importTime = new Date().toISOString();
  }
  
  // Set default status
  if (!taskData.status) {
    taskData.status = STATUS_VALUES.OPEN;
  }
  
  // Map data to columns
  // Map taskData to row
  Object.entries(taskData).forEach(([field, value]) => {
    // Convert camelCase to UPPER_SNAKE_CASE
    const columnKey = field.replace(/([A-Z])/g, '_$1').toUpperCase();
    const columnIndex = getColumnIndex(columnKey);
    
    // Map field to column
    
    if (columnIndex > 0) {
      row[columnIndex - 1] = value;
      // Set row value
    }
  });
  
  // Append row
  sheet.appendRow(row);
  const newRowIndex = sheet.getLastRow();
  
  info('Task created', {
    taskId: taskData.taskId,
    rowIndex: newRowIndex
  });
  
  // Debug logging
  // Format response
  // Check COLUMN_ORDER
  // COLUMN_ORDER length check
  
  const result = formatTaskResponse(row, newRowIndex, COLUMN_ORDER);
  // Return formatted result
  
  return result;
}

/**
 * Batch update tasks
 * @param {Array} updates - Array of {taskId, updates} objects
 * @returns {Array} Results
 */
function batchUpdateTasks(updates) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    throw new ApiError('No tasks found', 404);
  }
  
  const results = [];
  const taskIdColumn = getColumnIndex('TASK_ID') - 1;
  
  // Create task ID to row index map
  const taskRowMap = {};
  for (let i = 1; i < data.length; i++) {
    taskRowMap[data[i][taskIdColumn]] = i;
  }
  
  // Process updates
  updates.forEach(update => {
    const rowIndex = taskRowMap[update.taskId];
    
    if (!rowIndex) {
      results.push({
        taskId: update.taskId,
        success: false,
        error: 'Task not found'
      });
      return;
    }
    
    try {
      // Apply updates to data array
      Object.entries(update.updates).forEach(([field, value]) => {
        // Convert camelCase to UPPER_SNAKE_CASE
    const columnKey = field.replace(/([A-Z])/g, '_$1').toUpperCase();
        const columnIndex = getColumnIndex(columnKey) - 1;
        
        if (columnIndex >= 0) {
          data[rowIndex][columnIndex] = value;
        }
      });
      
      results.push({
        taskId: update.taskId,
        success: true
      });
    } catch (error) {
      results.push({
        taskId: update.taskId,
        success: false,
        error: error.message
      });
    }
  });
  
  // Write all updates at once
  const range = sheet.getRange(1, 1, data.length, COLUMN_ORDER.length);
  range.setValues(data);
  
  info('Batch update complete', {
    total: updates.length,
    successful: results.filter(r => r.success).length
  });
  
  return results;
}

/**
 * Delete task record
 * @param {string} taskId - Task ID to delete
 * @returns {boolean} Success
 */
function deleteTaskRecord(taskId) {
  const sheet = getTasksSheet();
  const rowIndex = findTaskRowIndex(taskId);
  
  if (rowIndex === -1) {
    throw new ApiError(`Task not found: ${taskId}`, 404);
  }
  
  // Delete row
  sheet.deleteRow(rowIndex);
  
  info('Task deleted', {
    taskId: taskId,
    rowIndex: rowIndex
  });
  
  return true;
}

/**
 * Mark task as exported
 * @param {string} taskId - Task ID
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Updated task
 */
function markTaskExported(taskId, exportBatchId) {
  return updateTaskRecord(taskId, {
    exportTime: new Date().toISOString(),
    exportBatchId: exportBatchId
  });
}

/**
 * Clear task assignment
 * @param {string} taskId - Task ID
 * @returns {Object} Updated task
 */
function clearTaskAssignment(taskId) {
  return updateTaskRecord(taskId, {
    agentEmail: '',
    startTime: '',
    status: STATUS_VALUES.OPEN
  });
}

/**
 * Complete task
 * @param {string} taskId - Task ID
 * @param {Object} artifacts - Task artifacts
 * @returns {Object} Updated task
 */
function completeTask(taskId, artifacts) {
  const updates = {
    status: STATUS_VALUES.COMPLETE,
    endTime: new Date().toISOString()
  };
  
  if (artifacts.objFileId) {
    updates.objLink = `https://drive.google.com/file/d/${artifacts.objFileId}/view`;
  }
  
  if (artifacts.alignmentFileId) {
    updates.alignmentLink = `https://drive.google.com/file/d/${artifacts.alignmentFileId}/view`;
  }
  
  if (artifacts.videoFileId) {
    updates.videoLink = `https://drive.google.com/file/d/${artifacts.videoFileId}/view`;
  }
  
  return updateTaskRecord(taskId, updates);
}