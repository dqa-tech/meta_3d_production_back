/**
 * Sheet read operations
 * Handles reading data from the tasks sheet
 */

/**
 * Get task by ID
 * @param {string} taskId - Task ID to find
 * @returns {Object|null} Task object or null
 */
function getTaskById(taskId) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return null;
  
  const taskIdColumn = getColumnIndex('TASK_ID') - 1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][taskIdColumn] === taskId) {
      return formatTaskResponse(data[i], i + 1, COLUMN_ORDER);
    }
  }
  
  return null;
}

/**
 * Query tasks with filters
 * @param {Object} filters - Query filters
 * @returns {Array} Array of tasks
 */
function queryTasks(filters = {}) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return [];
  
  let results = [];
  
  // Column indices
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  // Filter data
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let include = true;
    
    // Apply filters
    if (filters.batchId && row[columns.BATCH_ID] !== filters.batchId) {
      include = false;
    }
    
    if (filters.status && row[columns.STATUS] !== filters.status) {
      include = false;
    }
    
    if (filters.agentEmail && row[columns.AGENT_EMAIL] !== filters.agentEmail) {
      include = false;
    }
    
    if (filters.startDate) {
      const importTime = new Date(row[columns.IMPORT_TIME]);
      if (importTime < new Date(filters.startDate)) {
        include = false;
      }
    }
    
    if (filters.endDate) {
      const importTime = new Date(row[columns.IMPORT_TIME]);
      if (importTime > new Date(filters.endDate)) {
        include = false;
      }
    }
    
    if (include) {
      results.push(formatTaskResponse(row, i + 1, COLUMN_ORDER));
    }
  }
  
  // Apply pagination
  const offset = filters.offset || 0;
  const limit = filters.limit || 100;
  
  return results.slice(offset, offset + limit);
}

/**
 * Get all unique values for a column
 * @param {string} columnKey - Column key
 * @returns {Array} Unique values
 */
function getUniqueColumnValues(columnKey) {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return [];
  
  const columnIndex = getColumnIndex(columnKey);
  const values = sheet.getRange(2, columnIndex, lastRow - 1, 1).getValues();
  
  const uniqueValues = new Set();
  values.forEach(row => {
    const value = row[0];
    if (value && value !== '') {
      uniqueValues.add(value);
    }
  });
  
  return Array.from(uniqueValues).sort();
}

/**
 * Get batch information
 * @param {string} batchId - Batch ID
 * @returns {Object} Batch info
 */
function getBatchInfo(batchId) {
  const tasks = queryTasks({ batchId: batchId });
  
  if (tasks.length === 0) return null;
  
  const statuses = {};
  let earliestImport = null;
  let latestImport = null;
  
  tasks.forEach(task => {
    // Count statuses
    const status = task.status || 'unknown';
    statuses[status] = (statuses[status] || 0) + 1;
    
    // Track import times
    if (task.importTime) {
      const importDate = new Date(task.importTime);
      if (!earliestImport || importDate < earliestImport) {
        earliestImport = importDate;
      }
      if (!latestImport || importDate > latestImport) {
        latestImport = importDate;
      }
    }
  });
  
  return {
    batchId: batchId,
    taskCount: tasks.length,
    statuses: statuses,
    importStarted: earliestImport?.toISOString(),
    importCompleted: latestImport?.toISOString(),
    tasks: tasks
  };
}

/**
 * Get task statistics
 * @returns {Object} Statistics
 */
function getTaskStatistics() {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    return {
      totalTasks: 0,
      byStatus: {},
      byBatch: {},
      byAgent: {}
    };
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMN_ORDER.length).getValues();
  
  const stats = {
    totalTasks: data.length,
    byStatus: {},
    byBatch: {},
    byAgent: {},
    recentActivity: []
  };
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  data.forEach(row => {
    // Count by status
    const status = row[columns.STATUS] || 'unassigned';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // Count by batch
    const batchId = row[columns.BATCH_ID];
    if (batchId) {
      stats.byBatch[batchId] = (stats.byBatch[batchId] || 0) + 1;
    }
    
    // Count by agent
    const agent = row[columns.AGENT_EMAIL];
    if (agent) {
      stats.byAgent[agent] = (stats.byAgent[agent] || 0) + 1;
    }
  });
  
  return stats;
}

/**
 * Find row index by task ID
 * @param {string} taskId - Task ID
 * @returns {number} Row index (1-based) or -1
 */
function findTaskRowIndex(taskId) {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return -1;
  
  const taskIdColumn = getColumnIndex('TASK_ID') - 1;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][taskIdColumn] === taskId) {
      return i + 1; // Convert to 1-based index
    }
  }
  
  return -1;
}