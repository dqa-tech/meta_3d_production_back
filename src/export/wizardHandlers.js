/**
 * Export wizard server-side functions
 * Handles communication between UI and backend
 */

/**
 * Select tasks for export (wrapper for UI)
 * @param {Object} filters - Export filters
 * @returns {Object} Selection results
 */
function selectTasksForExport(filters) {
  try {
    return selectTasksForExport(filters);
  } catch (error) {
    error('Export selection failed', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Execute export tasks (wrapper for UI)
 * @param {Object} selection - Task selection
 * @param {string} targetFolderId - Target folder ID
 * @returns {Object} Export results
 */
function executeExportTasks(selection, targetFolderId) {
  try {
    // Generate export batch ID
    const exportBatchId = generateBatchId('EXP');
    
    // Create manifest from selection
    const manifest = prepareExportManifest(selection, exportBatchId);
    
    // Execute export
    const result = executeExport(manifest, targetFolderId);
    
    return result;
  } catch (error) {
    error('Export execution failed', {
      error: error.message
    });
    throw error;
  }
}

/**
 * Get export statistics
 * @returns {Object} Export statistics
 */
function getExportStatistics() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return {
      totalExported: 0,
      recentExports: [],
      exportsByBatch: {}
    };
  }
  
  const columns = {};
  COLUMN_ORDER.forEach(key => {
    columns[key] = getColumnIndex(key) - 1;
  });
  
  const stats = {
    totalExported: 0,
    recentExports: [],
    exportsByBatch: {}
  };
  
  const exportedTasks = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    if (row[columns.EXPORT_TIME]) {
      stats.totalExported++;
      
      const exportInfo = {
        taskId: row[columns.TASK_ID],
        folderName: row[columns.FOLDER_NAME],
        exportTime: row[columns.EXPORT_TIME],
        exportBatchId: row[columns.EXPORT_BATCH_ID]
      };
      
      exportedTasks.push(exportInfo);
      
      // Group by export batch
      const batchId = row[columns.EXPORT_BATCH_ID];
      if (batchId) {
        if (!stats.exportsByBatch[batchId]) {
          stats.exportsByBatch[batchId] = {
            batchId: batchId,
            count: 0,
            exportTime: row[columns.EXPORT_TIME]
          };
        }
        stats.exportsByBatch[batchId].count++;
      }
    }
  }
  
  // Sort and get recent exports
  stats.recentExports = exportedTasks
    .sort((a, b) => new Date(b.exportTime) - new Date(a.exportTime))
    .slice(0, 10);
  
  return stats;
}

/**
 * Create export report
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Export report
 */
function createExportReport(exportBatchId) {
  const tasks = queryTasks({ exportBatchId: exportBatchId });
  
  if (tasks.length === 0) {
    throw new Error(`No tasks found for export batch: ${exportBatchId}`);
  }
  
  const report = {
    exportBatchId: exportBatchId,
    exportDate: tasks[0].exportTime,
    taskCount: tasks.length,
    tasks: tasks.map(t => ({
      taskId: t.taskId,
      folderName: t.folderName,
      agentEmail: t.agentEmail,
      completedDate: t.endTime,
      files: {
        obj: !!t.objLink,
        alignment: !!t.alignmentLink,
        video: !!t.videoLink
      }
    }))
  };
  
  return report;
}

/**
 * Re-export failed tasks
 * @param {string} exportBatchId - Original export batch ID
 * @param {Array} taskIds - Task IDs to re-export
 * @param {string} targetFolderId - Target folder ID
 * @returns {Object} Re-export results
 */
function reExportTasks(exportBatchId, taskIds, targetFolderId) {
  // Get tasks
  const tasks = taskIds.map(id => getTaskById(id)).filter(t => t !== null);
  
  if (tasks.length === 0) {
    throw new Error('No valid tasks found for re-export');
  }
  
  // Create new export batch
  const newExportBatchId = generateBatchId('REXP');
  
  // Create manifest
  const manifest = {
    exportBatchId: newExportBatchId,
    originalBatchId: exportBatchId,
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser().email,
    tasks: tasks.map(t => ({
      taskId: t.taskId,
      folderName: t.folderName,
      files: getTaskExportFiles(t, {
        images: true,
        obj: true,
        alignment: true,
        video: true
      })
    }))
  };
  
  // Execute export
  return executeExport(manifest, targetFolderId);
}