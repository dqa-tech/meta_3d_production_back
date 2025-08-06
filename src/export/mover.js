/**
 * Export file mover
 * Handles copying files to client folder
 */

/**
 * Execute export operation
 * @param {Object} manifest - Export manifest
 * @param {string} targetFolderId - Target folder ID
 * @param {Function} onProgress - Progress callback
 * @returns {Object} Export results
 */
function executeExport(manifest, targetFolderId, onProgress) {
  const startTime = new Date();
  
  info('Starting export operation', {
    batchId: manifest.exportBatchId,
    taskCount: manifest.tasks.length,
    targetFolder: targetFolderId
  });
  
  try {
    // Verify target folder access
    if (!canWrite(targetFolderId)) {
      throw new DriveError('No write access to target folder');
    }
    
    // Create export batch folder
    const batchFolder = createExportBatchFolder(targetFolderId, manifest.exportBatchId);
    
    // Export tasks
    const results = exportTasksToFolder(
      manifest.tasks,
      batchFolder.id,
      manifest.filters.includeFiles,
      onProgress
    );
    
    // Update sheet records
    const sheetUpdateResults = updateExportedTasks(results, manifest.exportBatchId);
    
    // Create summary
    const summary = createExportSummary(results, manifest, batchFolder, startTime);
    
    info('Export operation complete', summary);
    
    return summary;
  } catch (error) {
    error('Export operation failed', {
      batchId: manifest.exportBatchId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Create export batch folder
 * @param {string} parentFolderId - Parent folder ID
 * @param {string} batchId - Batch ID
 * @returns {Object} Created folder
 */
function createExportBatchFolder(parentFolderId, batchId) {
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `Export_${timestamp}_${batchId}`;
  
  return createFolder(folderName, parentFolderId);
}

/**
 * Export tasks to folder
 * @param {Array} tasks - Tasks to export
 * @param {string} targetFolderId - Target folder ID
 * @param {Object} includeFiles - Which files to include
 * @param {Function} onProgress - Progress callback
 * @returns {Array} Export results
 */
function exportTasksToFolder(tasks, targetFolderId, includeFiles, onProgress) {
  const results = [];
  const progress = createProgressTracker(tasks.length, onProgress || (() => {}));
  
  // Process in chunks
  const chunks = chunk(tasks, 5);
  
  for (const chunk of chunks) {
    const chunkResults = chunk.map(task => 
      exportSingleTask(task, targetFolderId, includeFiles)
    );
    
    results.push(...chunkResults);
    progress.update(results.length);
    
    // Brief pause between chunks
    Utilities.sleep(500);
  }
  
  return results;
}

/**
 * Export single task
 * @param {Object} task - Task to export
 * @param {string} targetFolderId - Target folder ID
 * @param {Object} includeFiles - Which files to include
 * @returns {Object} Export result
 */
function exportSingleTask(task, targetFolderId, includeFiles) {
  const startTime = new Date();
  
  try {
    // Create task folder
    const taskFolder = createFolder(task.folderName, targetFolderId);
    
    // Copy files
    const copiedFiles = [];
    
    for (const file of task.files) {
      try {
        // Extract file ID from URL
        const fileId = extractFileIdFromUrl(file.url);
        
        if (fileId) {
          const copied = copyFile(fileId, taskFolder.id, file.name);
          copiedFiles.push({
            original: file,
            copied: copied,
            success: true
          });
        }
      } catch (error) {
        copiedFiles.push({
          original: file,
          error: error.message,
          success: false
        });
      }
    }
    
    const result = {
      taskId: task.taskId,
      folderName: task.folderName,
      success: true,
      taskFolder: taskFolder,
      files: copiedFiles,
      duration: new Date() - startTime
    };
    
    debug('Task exported', {
      taskId: task.taskId,
      filesCount: copiedFiles.filter(f => f.success).length
    });
    
    return result;
  } catch (error) {
    error('Failed to export task', {
      taskId: task.taskId,
      error: error.message
    });
    
    return {
      taskId: task.taskId,
      folderName: task.folderName,
      success: false,
      error: error.message,
      duration: new Date() - startTime
    };
  }
}

/**
 * Extract file ID from Drive URL
 * @param {string} url - Drive file URL
 * @returns {string|null} File ID
 */
function extractFileIdFromUrl(url) {
  if (!url) return null;
  
  // Match various Drive URL formats
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /\/([a-zA-Z0-9-_]+)\/view/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  // If no pattern matches, assume it's already a file ID
  return url;
}

/**
 * Update exported tasks in sheet
 * @param {Array} results - Export results
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Update results
 */
function updateExportedTasks(results, exportBatchId) {
  const updates = results
    .filter(r => r.success)
    .map(r => ({
      taskId: r.taskId,
      updates: {
        exportTime: new Date().toISOString(),
        exportBatchId: exportBatchId
      }
    }));
  
  if (updates.length === 0) {
    return { updated: 0, failed: 0 };
  }
  
  try {
    const updateResults = batchUpdateTasks(updates);
    
    return {
      updated: updateResults.filter(r => r.success).length,
      failed: updateResults.filter(r => !r.success).length
    };
  } catch (error) {
    error('Failed to update exported tasks', {
      error: error.message,
      taskCount: updates.length
    });
    
    return {
      updated: 0,
      failed: updates.length
    };
  }
}

/**
 * Create export summary
 * @param {Array} results - Export results
 * @param {Object} manifest - Export manifest
 * @param {Object} batchFolder - Batch folder
 * @param {Date} startTime - Start time
 * @returns {Object} Export summary
 */
function createExportSummary(results, manifest, batchFolder, startTime) {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const totalFiles = successful.reduce((sum, r) => 
    sum + r.files.filter(f => f.success).length, 0
  );
  
  const summary = {
    exportBatchId: manifest.exportBatchId,
    success: failed.length === 0,
    duration: new Date() - startTime,
    batchFolder: {
      id: batchFolder.id,
      name: batchFolder.name,
      url: batchFolder.url
    },
    stats: {
      totalTasks: results.length,
      successfulTasks: successful.length,
      failedTasks: failed.length,
      totalFiles: totalFiles
    },
    successfulExports: successful.map(r => ({
      taskId: r.taskId,
      folderName: r.folderName,
      filesCopied: r.files.filter(f => f.success).length
    })),
    failedExports: failed.map(r => ({
      taskId: r.taskId,
      folderName: r.folderName,
      error: r.error
    }))
  };
  
  return summary;
}