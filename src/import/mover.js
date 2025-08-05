/**
 * Import file mover
 * Handles copying task folders to production
 */

/**
 * Copy task folders to production
 * @param {Array} taskFolders - Task folders to copy
 * @param {string} productionFolderId - Production folder ID
 * @param {string} batchId - Batch ID for this import
 * @param {Function} onProgress - Progress callback
 * @returns {Array} Results of copy operations
 */
async function copyTasksToProduction(taskFolders, productionFolderId, batchId, onProgress) {
  info('Starting task copy to production', {
    taskCount: taskFolders.length,
    batchId: batchId
  });
  
  const results = [];
  const progress = createProgressTracker(taskFolders.length, onProgress || (() => {}));
  
  // Process in chunks to avoid timeout
  const chunks = chunk(taskFolders, 10);
  
  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(task => copyTaskFolder(task, productionFolderId, batchId))
    );
    
    results.push(...chunkResults);
    progress.update(results.length);
    
    // Brief pause between chunks
    Utilities.sleep(500);
  }
  
  info('Task copy complete', {
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length
  });
  
  return results;
}

/**
 * Copy single task folder
 * @param {Object} taskFolder - Task folder info
 * @param {string} productionFolderId - Production folder ID
 * @param {string} batchId - Batch ID
 * @returns {Object} Copy result
 */
async function copyTaskFolder(taskFolder, productionFolderId, batchId) {
  const startTime = new Date();
  
  try {
    // Copy the folder and its contents
    const copyResult = copyFolder(taskFolder.id, productionFolderId, taskFolder.name);
    
    const result = {
      success: true,
      taskId: generateUUID(),
      batchId: batchId,
      originalFolder: taskFolder,
      productionFolder: copyResult.folder,
      files: copyResult.files,
      copyDuration: new Date() - startTime,
      timestamp: new Date().toISOString()
    };
    
    debug('Task folder copied', {
      folder: taskFolder.name,
      duration: result.copyDuration
    });
    
    return result;
  } catch (error) {
    error('Failed to copy task folder', {
      folder: taskFolder.name,
      error: error.message
    });
    
    return {
      success: false,
      taskId: generateUUID(),
      batchId: batchId,
      originalFolder: taskFolder,
      error: error.message,
      copyDuration: new Date() - startTime,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Create import summary
 * @param {Array} copyResults - Results from copy operations
 * @returns {Object} Import summary
 */
function createImportSummary(copyResults) {
  const successful = copyResults.filter(r => r.success);
  const failed = copyResults.filter(r => !r.success);
  
  const totalCopyTime = copyResults.reduce((sum, r) => sum + (r.copyDuration || 0), 0);
  const averageCopyTime = copyResults.length > 0 ? totalCopyTime / copyResults.length : 0;
  
  return {
    totalTasks: copyResults.length,
    successful: successful.length,
    failed: failed.length,
    totalCopyTime: totalCopyTime,
    averageCopyTime: Math.round(averageCopyTime),
    successfulTasks: successful.map(r => ({
      taskId: r.taskId,
      folderName: r.originalFolder.name,
      productionUrl: r.productionFolder.url
    })),
    failedTasks: failed.map(r => ({
      taskId: r.taskId,
      folderName: r.originalFolder.name,
      error: r.error
    }))
  };
}

/**
 * Rollback failed import
 * @param {Array} copyResults - Copy results to rollback
 * @param {string} productionFolderId - Production folder ID
 * @returns {Object} Rollback results
 */
function rollbackImport(copyResults, productionFolderId) {
  warn('Starting import rollback', {
    tasks: copyResults.length
  });
  
  const rollbackResults = [];
  
  for (const result of copyResults) {
    if (result.success && result.productionFolder) {
      try {
        const folder = DriveApp.getFolderById(result.productionFolder.id);
        folder.setTrashed(true);
        
        rollbackResults.push({
          taskId: result.taskId,
          folderName: result.originalFolder.name,
          rolled_back: true
        });
      } catch (error) {
        rollbackResults.push({
          taskId: result.taskId,
          folderName: result.originalFolder.name,
          rolled_back: false,
          error: error.message
        });
      }
    }
  }
  
  return {
    totalRolledBack: rollbackResults.filter(r => r.rolled_back).length,
    failedRollbacks: rollbackResults.filter(r => !r.rolled_back).length,
    results: rollbackResults
  };
}