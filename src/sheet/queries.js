/**
 * Sheet query operations
 * Complex queries and data aggregation
 */

/**
 * Get tasks ready for export with simplified, clear filtering logic
 * @param {Object} filters - Simple staging filters
 * @returns {Array} Tasks ready for export
 */
function getTasksForExport(filters = {}) {
  // Use the new simplified filtering logic
  return getTasksForExportSimple(filters);
}

/**
 * Get tasks ready for export with simplified, clear filtering logic
 * @param {Object} filters - Simple staging filters
 * @returns {Array} Tasks ready for export
 */
function getTasksForExportSimple(filters = {}) {
  console.log('DEBUG: getTasksForExportSimple called with filters:', JSON.stringify(filters, null, 2));
  
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  console.log('DEBUG: Sheet has', data.length - 1, 'data rows');
  
  if (data.length <= 1) return [];
  
  // Build column index map
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  // Normalize and validate filters
  const normalizedFilters = {
    batchIds: Array.isArray(filters.batchIds) ? filters.batchIds : [],
    completedAfter: filters.completedAfter ? parseDate(filters.completedAfter) : null,
    completedBefore: filters.completedBefore ? parseDate(filters.completedBefore) : null,
    includeUnreviewed: filters.includeUnreviewed === true,
    includeFailed: filters.includeFailed === true
  };
  
  console.log('DEBUG: Normalized filters:', JSON.stringify(normalizedFilters, null, 2));
  
  const results = [];
  let includedCount = 0;
  let excludedCount = 0;
  let exclusionReasons = {
    notComplete: 0,
    missingArtifacts: 0,
    batchFilter: 0,
    dateFilter: 0,
    unreviewed: 0,
    failed: 0,
    unknownReview: 0,
    alreadyExported: 0
  };
  
  // Process each row sequentially
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let include = true;
    let exclusionReason = '';
    
    // STEP 1: Must be complete status
    const status = normalizeString(row[columns.STATUS]);
    if (status !== STATUS_VALUES.COMPLETE) {
      include = false;
      exclusionReason = 'notComplete';
      exclusionReasons.notComplete++;
    }
    
    // STEP 2: Must have production artifacts
    if (include && (!row[columns.OBJ_LINK] || !row[columns.VIDEO_LINK])) {
      include = false;
      exclusionReason = 'missingArtifacts';
      exclusionReasons.missingArtifacts++;
    }
    
    // STEP 3: Batch filter (if specified)
    if (include && normalizedFilters.batchIds.length > 0) {
      const batchId = normalizeString(row[columns.BATCH_ID]);
      if (!normalizedFilters.batchIds.some(filterBatch => normalizeString(filterBatch) === batchId)) {
        include = false;
        exclusionReason = 'batchFilter';
        exclusionReasons.batchFilter++;
      }
    }
    
    // STEP 4: Date range filters (if specified)
    if (include && (normalizedFilters.completedAfter || normalizedFilters.completedBefore)) {
      const endTime = parseDate(row[columns.END_TIME]);
      if (endTime) {
        if (normalizedFilters.completedAfter && endTime < normalizedFilters.completedAfter) {
          include = false;
          exclusionReason = 'dateFilter';
          exclusionReasons.dateFilter++;
        } else if (normalizedFilters.completedBefore && endTime > normalizedFilters.completedBefore) {
          include = false;
          exclusionReason = 'dateFilter';
          exclusionReasons.dateFilter++;
        }
      } else if (normalizedFilters.completedAfter || normalizedFilters.completedBefore) {
        // No end time but date filter specified - exclude
        include = false;
        exclusionReason = 'dateFilter';
        exclusionReasons.dateFilter++;
      }
    }
    
    // STEP 5: Review status logic (clear and explicit)
    if (include) {
      const reviewStatus = normalizeString(row[columns.REVIEW_STATUS]);
      
      if (!reviewStatus || reviewStatus === '') {
        // Task is unreviewed
        if (!normalizedFilters.includeUnreviewed) {
          include = false;
          exclusionReason = 'unreviewed';
          exclusionReasons.unreviewed++;
        }
      } else if (reviewStatus === REVIEW_STATUS_VALUES.FAILED) {
        // Task failed review
        if (!normalizedFilters.includeFailed) {
          include = false;
          exclusionReason = 'failed';
          exclusionReasons.failed++;
        }
      } else if (reviewStatus !== REVIEW_STATUS_VALUES.PASSED) {
        // Unknown review status - exclude for safety
        include = false;
        exclusionReason = 'unknownReview';
        exclusionReasons.unknownReview++;
      }
      // If reviewStatus === 'passed', always include (no additional check needed)
    }
    
    // STEP 6: Never include already exported tasks
    if (include) {
      const exportStatus = normalizeString(row[columns.EXPORT_STATUS]);
      const exportTime = row[columns.EXPORT_TIME];
      
      if (exportStatus === EXPORT_STATUS_VALUES.DELIVERED || 
          exportStatus === EXPORT_STATUS_VALUES.STAGED ||
          exportTime) {
        include = false;
        exclusionReason = 'alreadyExported';
        exclusionReasons.alreadyExported++;
      }
    }
    
    // Add to results if included
    if (include) {
      results.push(formatTaskResponse(row, i + 1, COLUMN_ORDER));
      includedCount++;
    } else {
      excludedCount++;
      
      // Log first few exclusions for debugging
      if (excludedCount <= 5) {
        console.log(`DEBUG: Task excluded - Reason: ${exclusionReason}, Status: ${row[columns.STATUS]}, ReviewStatus: "${row[columns.REVIEW_STATUS]}", ExportStatus: ${row[columns.EXPORT_STATUS]}`);
      }
    }
  }
  
  // Log summary
  console.log('DEBUG: Filtering complete - Included:', includedCount, 'Excluded:', excludedCount);
  console.log('DEBUG: Exclusion breakdown:', JSON.stringify(exclusionReasons, null, 2));
  
  return results;
}

/**
 * Normalize string values to handle edge cases
 * @param {*} value - Value to normalize
 * @returns {string} Normalized string
 */
function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Parse date with error handling
 * @param {*} value - Date value to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get tasks by their IDs
 * @param {Array} taskIds - Array of task IDs
 * @returns {Array} Task objects for the given IDs
 */
function getTasksByIds(taskIds) {
  if (!taskIds || taskIds.length === 0) return [];
  
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  // Build column index map
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  const results = [];
  
  // Process each row to find matching task IDs
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const taskId = row[columns.TASK_ID];
    
    if (taskIds.includes(taskId)) {
      results.push(formatTaskResponse(row, i + 1, COLUMN_ORDER));
    }
  }
  
  return results;
}

/**
 * Get staged export batches for delivery
 * @returns {Array} Staged export batch summaries
 */
function getStagedExportBatches() {
  try {
    console.log('DEBUG: getStagedExportBatches() called');
    
    const sheet = getTasksSheet();
    if (!sheet) {
      console.error('ERROR: getTasksSheet() returned null');
      return [];
    }
    
    console.log('DEBUG: Got sheet, getting data range');
    const data = sheet.getDataRange().getValues();
    console.log('DEBUG: Got data, rows:', data.length);
    
    // Validate data structure
    if (!Array.isArray(data)) {
      console.error('ERROR: getDataRange().getValues() returned non-array:', typeof data);
      return [];
    }
  
  if (data.length <= 1) return [];
  
  // Validate required constants
  if (!COLUMN_ORDER || !Array.isArray(COLUMN_ORDER)) {
    console.error('ERROR: COLUMN_ORDER is not defined or not an array');
    return [];
  }
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    const index = getColumnIndex(key);
    if (index === undefined || index === null || index < 1) {
      console.error('ERROR: Invalid column index for', key, ':', index);
      return [];
    }
    columns[key] = index - 1;
  });
  
  const batches = {};
  
  // Validate EXPORT_STATUS_VALUES constant
  if (!EXPORT_STATUS_VALUES || !EXPORT_STATUS_VALUES.STAGED) {
    console.error('ERROR: EXPORT_STATUS_VALUES.STAGED is not defined');
    return [];
  }
  
  // Find all tasks with staged export status OR failed delivery status
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[columns.EXPORT_STATUS] === EXPORT_STATUS_VALUES.STAGED || 
        row[columns.EXPORT_STATUS] === EXPORT_STATUS_VALUES.DELIVERY_FAILED) {
      const batchId = row[columns.EXPORT_BATCH_ID];
      
      if (batchId && !batches[batchId]) {
        batches[batchId] = {
          exportBatchId: batchId,
          taskCount: 0,
          stagedCount: 0,
          failedCount: 0,
          createdDate: null,
          stagingFolderPath: null,
          hasFailures: false
        };
      }
      
      if (batchId) {
        batches[batchId].taskCount++;
        
        // Track status-specific counts
        const exportStatus = row[columns.EXPORT_STATUS];
        if (exportStatus === EXPORT_STATUS_VALUES.STAGED) {
          batches[batchId].stagedCount++;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED) {
          batches[batchId].failedCount++;
          batches[batchId].hasFailures = true;
        }
        
        // Use export time as created date (when staging was completed)
        const exportTime = row[columns.EXPORT_TIME];
        if (exportTime && (!batches[batchId].createdDate || 
                          new Date(exportTime) < new Date(batches[batchId].createdDate))) {
          batches[batchId].createdDate = exportTime;
        }
      }
    }
  }
  
  // Add staging folder paths
  const stagingConfig = getStagingConfiguration();
  if (stagingConfig && stagingConfig.isValid) {
    Object.values(batches).forEach(batch => {
      const dateStr = batch.createdDate ? 
        batch.createdDate.split('T')[0] : 
        new Date().toISOString().split('T')[0];
      
      batch.stagingFolderPath = `${stagingConfig.folderName}/Export_${dateStr}_${batch.exportBatchId}`;
    });
  }
  
  const result = Object.values(batches).sort((a, b) => 
    new Date(b.createdDate || 0) - new Date(a.createdDate || 0)
  );
  
  console.log('DEBUG: Returning', result.length, 'staged batches');
  return result;
  
  } catch (error) {
    console.error('ERROR: getStagedExportBatches() failed:', error.message);
    return []; // Return empty array instead of null on error
  }
}

/**
 * Get agent performance metrics
 * @param {string} agentEmail - Agent email (optional)
 * @returns {Object} Performance metrics
 */
function getAgentMetrics(agentEmail = null) {
  const tasks = agentEmail ? 
    queryTasks({ agentEmail: agentEmail }) : 
    queryTasks({});
  
  const metrics = {};
  
  // Group by agent
  tasks.forEach(task => {
    const agent = task.agentEmail;
    if (!agent) return;
    
    if (!metrics[agent]) {
      metrics[agent] = {
        email: agent,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        totalDuration: 0,
        averageDuration: 0,
        completionRate: 0
      };
    }
    
    metrics[agent].totalTasks++;
    
    if (task.status === STATUS_VALUES.COMPLETE) {
      metrics[agent].completedTasks++;
      
      // Calculate duration
      if (task.startTime && task.endTime) {
        const duration = new Date(task.endTime) - new Date(task.startTime);
        metrics[agent].totalDuration += duration;
      }
    } else if (task.status === STATUS_VALUES.IN_PROGRESS) {
      metrics[agent].inProgressTasks++;
    }
  });
  
  // Calculate averages
  Object.values(metrics).forEach(agent => {
    if (agent.completedTasks > 0) {
      agent.averageDuration = Math.round(agent.totalDuration / agent.completedTasks / 1000 / 60); // minutes
      agent.completionRate = Math.round((agent.completedTasks / agent.totalTasks) * 100);
    }
  });
  
  return agentEmail ? metrics[agentEmail] || null : metrics;
}

/**
 * Get batch progress
 * @param {string} batchId - Batch ID
 * @returns {Object} Batch progress info
 */
function getBatchProgress(batchId) {
  const batch = getBatchInfo(batchId);
  
  if (!batch) return null;
  
  const progress = {
    batchId: batchId,
    totalTasks: batch.taskCount,
    progress: {},
    completionRate: 0,
    estimatedCompletion: null
  };
  
  // Calculate progress by status
  Object.entries(batch.statuses).forEach(([status, count]) => {
    progress.progress[status] = {
      count: count,
      percentage: Math.round((count / batch.taskCount) * 100)
    };
  });
  
  // Calculate completion rate
  const completed = batch.statuses[STATUS_VALUES.COMPLETE] || 0;
  progress.completionRate = Math.round((completed / batch.taskCount) * 100);
  
  // Estimate completion time
  if (batch.statuses[STATUS_VALUES.IN_PROGRESS] > 0) {
    const inProgress = batch.statuses[STATUS_VALUES.IN_PROGRESS];
    const avgDuration = getAverageTaskDuration();
    
    if (avgDuration > 0) {
      const remainingTasks = batch.taskCount - completed;
      const estimatedMinutes = (remainingTasks * avgDuration) / inProgress;
      progress.estimatedCompletion = new Date(Date.now() + estimatedMinutes * 60000).toISOString();
    }
  }
  
  return progress;
}

/**
 * Get average task duration
 * @returns {number} Average duration in minutes
 */
function getAverageTaskDuration() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return 0;
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  let totalDuration = 0;
  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[columns.STATUS] === STATUS_VALUES.COMPLETE && 
        row[columns.START_TIME] && 
        row[columns.END_TIME]) {
      const duration = new Date(row[columns.END_TIME]) - new Date(row[columns.START_TIME]);
      totalDuration += duration;
      count++;
    }
  }
  
  return count > 0 ? Math.round(totalDuration / count / 1000 / 60) : 0;
}

/**
 * Find tasks with issues
 * @returns {Array} Tasks with potential issues
 */
function findProblematicTasks() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  const issues = [];
  const avgDuration = getAverageTaskDuration();
  const longTaskThreshold = avgDuration * 3; // 3x average
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const task = formatTaskResponse(row, i + 1, COLUMN_ORDER);
    task.issues = [];
    
    // Check for stalled in-progress tasks
    if (row[columns.STATUS] === STATUS_VALUES.IN_PROGRESS && row[columns.START_TIME]) {
      const duration = Date.now() - new Date(row[columns.START_TIME]);
      const durationMinutes = duration / 1000 / 60;
      
      if (durationMinutes > longTaskThreshold) {
        task.issues.push(`In progress for ${Math.round(durationMinutes)} minutes (avg: ${avgDuration} min)`);
      }
    }
    
    // Check for incomplete exports
    if (row[columns.STATUS] === STATUS_VALUES.COMPLETE && 
        !row[columns.EXPORT_TIME] &&
        row[columns.END_TIME]) {
      const daysSinceComplete = (Date.now() - new Date(row[columns.END_TIME])) / 1000 / 60 / 60 / 24;
      if (daysSinceComplete > 7) {
        task.issues.push(`Completed ${Math.round(daysSinceComplete)} days ago but not exported`);
      }
    }
    
    // Check for missing artifacts
    if (row[columns.STATUS] === STATUS_VALUES.COMPLETE) {
      if (!row[columns.OBJ_LINK]) task.issues.push('Missing 3D object file');
      if (!row[columns.VIDEO_LINK]) task.issues.push('Missing task video');
      if (!row[columns.ALIGNMENT_LINK]) task.issues.push('Missing alignment image');
    }
    
    if (task.issues.length > 0) {
      issues.push(task);
    }
  }
  
  return issues;
}