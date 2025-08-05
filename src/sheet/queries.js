/**
 * Sheet query operations
 * Complex queries and data aggregation
 */

/**
 * Get tasks ready for export
 * @param {Object} filters - Export filters
 * @returns {Array} Tasks ready for export
 */
function getTasksForExport(filters = {}) {
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
    
    // Must be complete
    if (row[columns.STATUS] !== STATUS_VALUES.COMPLETE) {
      include = false;
    }
    
    // Must have production artifacts
    if (!row[columns.OBJ_LINK] || !row[columns.VIDEO_LINK]) {
      include = false;
    }
    
    // Must not be already exported (unless force export)
    if (row[columns.EXPORT_TIME] && !filters.includeExported) {
      include = false;
    }
    
    // Apply additional filters
    if (filters.batchId && row[columns.BATCH_ID] !== filters.batchId) {
      include = false;
    }
    
    if (filters.agentEmail && row[columns.AGENT_EMAIL] !== filters.agentEmail) {
      include = false;
    }
    
    if (filters.completedAfter) {
      const endTime = row[columns.END_TIME];
      if (!endTime || new Date(endTime) < new Date(filters.completedAfter)) {
        include = false;
      }
    }
    
    if (filters.completedBefore) {
      const endTime = row[columns.END_TIME];
      if (!endTime || new Date(endTime) > new Date(filters.completedBefore)) {
        include = false;
      }
    }
    
    if (include) {
      results.push(formatTaskResponse(row, i + 1, COLUMN_ORDER));
    }
  }
  
  return results;
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