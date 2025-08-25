/**
 * Export status management
 * Handles export status updates and queries
 */

/**
 * Update export status for multiple tasks (simplified for direct export)
 * @param {Array} taskIds - Task IDs to update
 * @param {string} status - New export status
 * @param {string} exportBatchId - Optional export batch ID
 * @returns {Object} Update results
 */
function updateTaskExportStatus(taskIds, status, exportBatchId = null) {
  if (!taskIds || taskIds.length === 0) {
    return { updated: 0, failed: 0 };
  }
  
  // Validate status
  const validStatuses = Object.values(EXPORT_STATUS_VALUES);
  if (!validStatuses.includes(status)) {
    throw new ValidationError(`Invalid export status: ${status}`);
  }
  
  const updates = taskIds.map(taskId => {
    const taskUpdates = { 
      exportStatus: status,
      exportTime: new Date().toISOString()
    };
    
    // Add export batch ID if provided
    if (exportBatchId) {
      taskUpdates.exportBatchId = exportBatchId;
    }
    
    return {
      taskId: taskId,
      updates: taskUpdates
    };
  });
  
  try {
    const results = batchUpdateTasksOptimized(updates);
    
    debug('Export status updated', {
      status: status,
      taskCount: taskIds.length,
      successful: results.filter(r => r.success).length
    });
    
    return {
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results: results
    };
    
  } catch (err) {
    error('Failed to update export status', {
      taskCount: taskIds.length,
      status: status,
      error: err.message
    });
    throw err;
  }
}

/**
 * Get tasks by export status
 * @param {string} status - Export status to filter by
 * @param {string} exportBatchId - Optional export batch filter
 * @returns {Array} Matching tasks
 */
function getTasksByExportStatus(status, exportBatchId = null) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  const results = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let include = true;
    
    // Filter by export status
    if (row[columns.EXPORT_STATUS] !== status) {
      include = false;
    }
    
    // Filter by export batch ID if provided
    if (exportBatchId && row[columns.EXPORT_BATCH_ID] !== exportBatchId) {
      include = false;
    }
    
    if (include) {
      results.push(formatTaskResponse(row, i + 1, COLUMN_ORDER));
    }
  }
  
  return results;
}

/**
 * Reset task export status (admin override)
 * @param {string} taskId - Task ID to reset
 * @param {string} newStatus - New export status
 * @param {string} reason - Reason for reset
 * @returns {Object} Updated task
 */
function resetTaskExportStatus(taskId, newStatus, reason) {
  // Validate status
  const validStatuses = Object.values(EXPORT_STATUS_VALUES);
  if (!validStatuses.includes(newStatus)) {
    throw new ValidationError(`Invalid export status: ${newStatus}`);
  }
  
  const updates = {
    exportStatus: newStatus
  };
  
  // Clear related fields when resetting
  if (newStatus === EXPORT_STATUS_VALUES.NULL) {
    updates.exportBatchId = '';
    updates.stagedCount = '';
    updates.exportTime = '';
  }
  
  const result = updateTaskRecord(taskId, updates);
  
  info('Export status reset', {
    taskId: taskId,
    newStatus: newStatus,
    reason: reason
  });
  
  return result;
}

/**
 * Get export status summary for all tasks
 * @returns {Object} Status summary
 */
function getExportStatusSummary() {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return {
      totalTasks: 0,
      byStatus: {},
      activeBatches: []
    };
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMN_ORDER.length).getValues();
  
  const summary = {
    totalTasks: data.length,
    byStatus: {},
    activeBatches: {},
    completedTasks: 0,
    exportableTasks: 0
  };
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  data.forEach(row => {
    // Count by export status
    const exportStatus = row[columns.EXPORT_STATUS] || 'not_exported';
    summary.byStatus[exportStatus] = (summary.byStatus[exportStatus] || 0) + 1;
    
    // Count completed tasks
    if (row[columns.STATUS] === STATUS_VALUES.COMPLETE) {
      summary.completedTasks++;
      
      // Count exportable tasks (complete with artifacts, not yet exported)
      if (!row[columns.EXPORT_TIME] && 
          row[columns.OBJ_LINK] && 
          row[columns.VIDEO_LINK]) {
        summary.exportableTasks++;
      }
    }
    
    // Track active export batches
    const exportBatchId = row[columns.EXPORT_BATCH_ID];
    if (exportBatchId) {
      if (!summary.activeBatches[exportBatchId]) {
        summary.activeBatches[exportBatchId] = {
          batchId: exportBatchId,
          taskCount: 0,
          byStatus: {}
        };
      }
      
      summary.activeBatches[exportBatchId].taskCount++;
      const status = row[columns.EXPORT_STATUS] || 'unknown';
      summary.activeBatches[exportBatchId].byStatus[status] = 
        (summary.activeBatches[exportBatchId].byStatus[status] || 0) + 1;
    }
  });
  
  return summary;
}


/**
 * Get export status transitions for task
 * @param {string} taskId - Task ID
 * @returns {Array} Status transition history
 */
function getTaskExportHistory(taskId) {
  // This would require additional logging implementation
  // For now, return current status
  const task = getTaskById(taskId);
  
  if (!task) {
    return [];
  }
  
  const history = [];
  
  if (task.exportStatus) {
    history.push({
      status: task.exportStatus,
      timestamp: task.exportTime || new Date().toISOString(),
      batchId: task.exportBatchId
    });
  }
  
  return history;
}

/**
 * Mark export batch as complete
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Update summary
 */
function markExportBatchComplete(exportBatchId) {
  // Get all tasks for this batch that are currently staged or delivering
  const batchTasks = queryTasks({}).filter(task => 
    task.exportBatchId === exportBatchId &&
    (task.exportStatus === EXPORT_STATUS_VALUES.STAGED ||
     task.exportStatus === EXPORT_STATUS_VALUES.DELIVERING)
  );
  
  if (batchTasks.length === 0) {
    return { updated: 0, message: 'No tasks found for batch' };
  }
  
  const taskIds = batchTasks.map(t => t.taskId);
  const result = updateTaskExportStatus(
    taskIds, 
    EXPORT_STATUS_VALUES.DELIVERED, 
    exportBatchId
  );
  
  // Update export time for delivered tasks
  const timeUpdates = taskIds.map(taskId => ({
    taskId: taskId,
    updates: { exportTime: new Date().toISOString() }
  }));
  
  batchUpdateTasksOptimized(timeUpdates);
  
  info('Export batch marked complete', {
    batchId: exportBatchId,
    taskCount: taskIds.length
  });
  
  return {
    updated: result.updated,
    message: `${result.updated} tasks marked as delivered`
  };
}

/**
 * Get export progress for batch
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Progress summary
 */
function getExportBatchProgress(exportBatchId) {
  const batchTasks = queryTasks({}).filter(task => 
    task.exportBatchId === exportBatchId
  );
  
  if (batchTasks.length === 0) {
    return {
      batchId: exportBatchId,
      exists: false
    };
  }
  
  const progress = {
    batchId: exportBatchId,
    exists: true,
    totalTasks: batchTasks.length,
    byStatus: {},
    percentComplete: 0,
    startTime: null,
    estimatedCompletion: null
  };
  
  // Count by status
  batchTasks.forEach(task => {
    const status = task.exportStatus || 'not_started';
    progress.byStatus[status] = (progress.byStatus[status] || 0) + 1;
    
    // Track earliest start time
    if (task.exportTime && 
        (!progress.startTime || 
         new Date(task.exportTime) < new Date(progress.startTime))) {
      progress.startTime = task.exportTime;
    }
  });
  
  // Calculate completion percentage
  const completedCount = progress.byStatus[EXPORT_STATUS_VALUES.DELIVERED] || 0;
  progress.percentComplete = Math.round((completedCount / progress.totalTasks) * 100);
  
  return progress;
}