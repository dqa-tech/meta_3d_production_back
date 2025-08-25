/**
 * Core Export System - Direct Task to Client Export
 * Single-file implementation with real-time progress tracking
 */

/**
 * Get available export batches that can be exported
 * @returns {Array} Available export batches
 */
function getAvailableExportBatches() {
  info('Getting available export batches');
  
  try {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    // Build column index map
    const columns = {};
    COLUMN_ORDER.forEach(key => {
      columns[key] = getColumnIndex(key) - 1;
    });
    
    const batches = {};
    
    // Find all tasks with export batch IDs and relevant statuses
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const exportBatchId = row[columns.EXPORT_BATCH_ID];
      const exportStatus = row[columns.EXPORT_STATUS];
      const taskStatus = row[columns.STATUS];
      
      // Only include batches with staged or delivery_failed tasks
      if (exportBatchId && 
          (exportStatus === EXPORT_STATUS_VALUES.STAGED || 
           exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED)) {
        
        if (!batches[exportBatchId]) {
          batches[exportBatchId] = {
            exportBatchId: exportBatchId,
            totalTasks: 0,
            stagedTasks: 0,
            failedTasks: 0,
            deliveredTasks: 0,
            createdDate: null,
            lastActivity: null,
            needsAttention: false
          };
        }
        
        const batch = batches[exportBatchId];
        batch.totalTasks++;
        
        // Count by export status
        if (exportStatus === EXPORT_STATUS_VALUES.STAGED) {
          batch.stagedTasks++;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED) {
          batch.failedTasks++;
          batch.needsAttention = true;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERED) {
          batch.deliveredTasks++;
        }
        
        // Track dates (using export time or import time as fallback)
        const exportTime = row[columns.EXPORT_TIME];
        const importTime = row[columns.IMPORT_TIME];
        const relevantTime = exportTime || importTime;
        
        if (relevantTime) {
          const date = new Date(relevantTime);
          if (!batch.createdDate || date < batch.createdDate) {
            batch.createdDate = date;
          }
          if (!batch.lastActivity || date > batch.lastActivity) {
            batch.lastActivity = date;
          }
        }
      }
    }
    
    // Convert to array and sort by last activity (newest first)
    const batchArray = Object.values(batches)
      .filter(batch => batch.stagedTasks > 0 || batch.failedTasks > 0)
      .sort((a, b) => {
        const dateA = a.lastActivity || a.createdDate || new Date(0);
        const dateB = b.lastActivity || b.createdDate || new Date(0);
        return dateB - dateA;
      });
    
    info('Found available export batches', {
      totalBatches: batchArray.length,
      withFailures: batchArray.filter(b => b.needsAttention).length
    });
    
    return batchArray;
    
  } catch (err) {
    error('Failed to get available export batches', { error: err.message });
    throw new Error(`Failed to get export batches: ${err.message}`);
  }
}

/**
 * Get tasks for a specific export batch
 * @param {string} exportBatchId - Export batch ID
 * @returns {Array} Tasks in the batch ready for export
 */
function getTasksByExportBatch(exportBatchId) {
  info('Getting tasks for export batch', { batchId: exportBatchId });
  
  try {
    // Get tasks with this export batch ID and relevant statuses
    const stagedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGED, exportBatchId);
    const failedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED, exportBatchId);
    
    // Combine and sort by task ID for consistent processing order
    const allTasks = [...stagedTasks, ...failedTasks]
      .sort((a, b) => a.taskId.localeCompare(b.taskId));
    
    info('Found tasks for export batch', {
      batchId: exportBatchId,
      totalTasks: allTasks.length,
      stagedTasks: stagedTasks.length,
      failedTasks: failedTasks.length
    });
    
    return allTasks;
    
  } catch (err) {
    error('Failed to get tasks for export batch', {
      batchId: exportBatchId,
      error: err.message
    });
    throw new Error(`Failed to get tasks for batch ${exportBatchId}: ${err.message}`);
  }
}

/**
 * Validate client folder access and structure
 * @param {string} folderId - Client folder ID
 * @returns {Object} Validation result
 */
function validateClientFolder(folderId) {
  if (!folderId) {
    return {
      valid: false,
      error: 'Folder ID is required'
    };
  }
  
  // Validate folder ID format
  if (!/^[a-zA-Z0-9-_]{25,}$/.test(folderId)) {
    return {
      valid: false,
      error: 'Invalid folder ID format'
    };
  }
  
  try {
    // Check folder access
    const folder = DriveApp.getFolderById(folderId);
    const folderName = folder.getName();
    
    // Test write access by creating/deleting a test file
    const testFile = DriveApp.createFile('__export_test__.txt', 'test');
    folder.addFile(testFile);
    testFile.setTrashed(true);
    
    info('Client folder validated', {
      folderId: folderId,
      folderName: folderName
    });
    
    return {
      valid: true,
      folderId: folderId,
      folderName: folderName,
      folderUrl: folder.getUrl()
    };
    
  } catch (err) {
    warn('Client folder validation failed', {
      folderId: folderId,
      error: err.message
    });
    
    let errorMessage = 'Unable to access folder';
    if (err.message.includes('not found')) {
      errorMessage = 'Folder not found or you don\'t have access';
    } else if (err.message.includes('permission')) {
      errorMessage = 'Insufficient permissions to write to this folder';
    }
    
    return {
      valid: false,
      error: errorMessage
    };
  }
}

/**
 * Main export function - processes export batch directly to client folder
 * @param {string} exportBatchId - Export batch ID to export
 * @param {string} clientFolderId - Client destination folder ID
 * @returns {Object} Export results
 */
function executeExport(exportBatchId, clientFolderId) {
  const startTime = new Date();
  const exportId = Utilities.getUuid().substring(0, 8);
  
  info('Starting batch export operation', {
    exportId: exportId,
    exportBatchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  // Get tasks for this export batch
  const tasksToExport = getTasksByExportBatch(exportBatchId);
  if (tasksToExport.length === 0) {
    throw new Error(`No exportable tasks found in batch ${exportBatchId}`);
  }
  
  const taskIds = tasksToExport.map(task => task.taskId);
  
  info('Found tasks in export batch', {
    batchId: exportBatchId,
    taskCount: taskIds.length
  });
  
  // Initialize export session
  const session = createExportSession(exportId, taskIds, clientFolderId, exportBatchId);
  
  try {
    // Validate client folder first
    const folderValidation = validateClientFolder(clientFolderId);
    if (!folderValidation.valid) {
      throw new Error(`Client folder validation failed: ${folderValidation.error}`);
    }
    
    // Update session with client info
    session.clientFolder = folderValidation;
    updateExportSession(session);
    
    // Process each task
    for (let i = 0; i < taskIds.length; i++) {
      const taskId = taskIds[i];
      
      // Check for timeout (5 minutes max)
      const elapsed = new Date() - startTime;
      if (elapsed > 300000) {
        throw new Error('Export operation timed out after 5 minutes');
      }
      
      // Update current task
      session.currentTaskIndex = i;
      session.currentTask = `Processing task ${i + 1}/${taskIds.length}`;
      updateExportSession(session);
      
      try {
        // Update task status to delivering (reusing existing status)
        updateTaskExportStatus([taskId], EXPORT_STATUS_VALUES.DELIVERING);
        
        // Get task details
        const task = getTaskById(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }
        
        // Copy production files to client folder
        const copyResult = copyTaskProductionFiles(task, clientFolderId);
        
        if (copyResult.success) {
          // Mark as delivered (reusing existing status)
          updateTaskExportStatus([taskId], EXPORT_STATUS_VALUES.DELIVERED);
          session.completedTasks++;
          session.totalFilesCopied += copyResult.filesCopied;
          
          logExportEvent(exportId, 'Task exported successfully', {
            taskId: taskId,
            folderName: task.folderName,
            filesCopied: copyResult.filesCopied
          });
          
        } else {
          // Mark as failed (reusing existing status)
          updateTaskExportStatus([taskId], EXPORT_STATUS_VALUES.DELIVERY_FAILED);
          session.failedTasks++;
          session.errors.push({
            taskId: taskId,
            folderName: task.folderName,
            error: copyResult.error
          });
          
          warn('Task export failed', {
            taskId: taskId,
            folderName: task.folderName,
            error: copyResult.error
          });
        }
        
      } catch (taskError) {
        // Handle individual task error
        session.failedTasks++;
        session.errors.push({
          taskId: taskId,
          folderName: 'unknown',
          error: taskError.message
        });
        
        // Try to mark as failed
        try {
          updateTaskExportStatus([taskId], EXPORT_STATUS_VALUES.DELIVERY_FAILED);
        } catch (statusError) {
          warn('Failed to update task status after error', {
            taskId: taskId,
            statusError: statusError.message
          });
        }
        
        error('Task processing failed', {
          taskId: taskId,
          error: taskError.message
        });
      }
      
      // Update progress
      const processed = session.completedTasks + session.failedTasks;
      session.progress = Math.round((processed / session.totalTasks) * 100);
      updateExportSession(session);
    }
    
    // Finalize session
    session.status = 'completed';
    session.endTime = new Date();
    session.duration = session.endTime - session.startTime;
    updateExportSession(session);
    
    const summary = {
      success: session.failedTasks === 0,
      exportId: exportId,
      duration: session.duration,
      stats: {
        totalTasks: session.totalTasks,
        completedTasks: session.completedTasks,
        failedTasks: session.failedTasks,
        totalFilesCopied: session.totalFilesCopied
      },
      errors: session.errors,
      clientFolder: session.clientFolder
    };
    
    info('Export operation completed', summary);
    return summary;
    
  } catch (err) {
    // Handle critical export failure
    session.status = 'failed';
    session.endTime = new Date();
    session.duration = session.endTime - session.startTime;
    session.criticalError = err.message;
    updateExportSession(session);
    
    error('Export operation failed', {
      exportId: exportId,
      error: err.message,
      duration: session.duration
    });
    
    return {
      success: false,
      exportId: exportId,
      duration: session.duration,
      error: err.message,
      stats: {
        totalTasks: session.totalTasks,
        completedTasks: session.completedTasks,
        failedTasks: session.failedTasks,
        totalFilesCopied: session.totalFilesCopied
      },
      errors: session.errors
    };
  }
}

/**
 * Copy production files from task folder to client task folder
 * @param {Object} task - Task object with folder details
 * @param {string} clientFolderId - Client base folder ID
 * @returns {Object} Copy result
 */
function copyTaskProductionFiles(task, clientFolderId) {
  try {
    // Get production folder
    if (!task.productionFolderId) {
      return {
        success: false,
        error: 'No production folder ID available'
      };
    }
    
    const prodFolder = DriveApp.getFolderById(task.productionFolderId);
    
    // Find matching client task folder
    const clientFolder = DriveApp.getFolderById(clientFolderId);
    const taskFolders = clientFolder.getFoldersByName(task.folderName);
    
    if (!taskFolders.hasNext()) {
      return {
        success: false,
        error: `Client task folder '${task.folderName}' not found`
      };
    }
    
    const targetFolder = taskFolders.next();
    
    // Get files from production folder
    const excludeFiles = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];
    const files = prodFolder.getFiles();
    let copiedCount = 0;
    const copiedFiles = [];
    const errors = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      
      // Skip original input files
      if (excludeFiles.includes(fileName.toLowerCase())) {
        continue;
      }
      
      try {
        // Copy file to client folder
        const copiedFile = file.makeCopy(fileName, targetFolder);
        copiedFiles.push(fileName);
        copiedCount++;
        
        debug('File copied', {
          fileName: fileName,
          taskFolder: task.folderName,
          targetFolderId: targetFolder.getId()
        });
        
      } catch (fileError) {
        errors.push(`${fileName}: ${fileError.message}`);
        warn('Failed to copy file', {
          fileName: fileName,
          error: fileError.message
        });
      }
    }
    
    if (copiedCount === 0) {
      return {
        success: false,
        error: 'No production files found to copy'
      };
    }
    
    if (errors.length > 0 && copiedCount === 0) {
      return {
        success: false,
        error: `All file copies failed: ${errors.join(', ')}`
      };
    }
    
    return {
      success: true,
      filesCopied: copiedCount,
      copiedFiles: copiedFiles,
      errors: errors.length > 0 ? errors : null
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Create export session for progress tracking
 * @param {string} exportId - Export ID
 * @param {Array} taskIds - Task IDs to export
 * @param {string} clientFolderId - Client folder ID
 * @param {string} exportBatchId - Export batch ID (optional)
 * @returns {Object} Export session
 */
function createExportSession(exportId, taskIds, clientFolderId, exportBatchId = null) {
  const session = {
    id: exportId,
    exportBatchId: exportBatchId,
    status: 'in_progress',
    startTime: new Date(),
    totalTasks: taskIds.length,
    completedTasks: 0,
    failedTasks: 0,
    currentTaskIndex: -1,
    currentTask: 'Initializing...',
    progress: 0,
    totalFilesCopied: 0,
    errors: [],
    clientFolderId: clientFolderId
  };
  
  updateExportSession(session);
  return session;
}

/**
 * Update export session in properties
 * @param {Object} session - Export session object
 */
function updateExportSession(session) {
  try {
    const key = `export_${session.id}`;
    const data = JSON.stringify(session);
    PropertiesService.getScriptProperties().setProperty(key, data);
  } catch (err) {
    warn('Failed to update export session', {
      exportId: session.id,
      error: err.message
    });
  }
}

/**
 * Get export progress for real-time tracking
 * @param {string} exportId - Export ID
 * @returns {Object} Progress data
 */
function getExportProgress(exportId) {
  try {
    const key = `export_${exportId}`;
    const data = PropertiesService.getScriptProperties().getProperty(key);
    
    if (!data) {
      return {
        success: false,
        error: 'Export session not found'
      };
    }
    
    const session = JSON.parse(data);
    
    return {
      success: true,
      progress: {
        exportId: exportId,
        status: session.status,
        progress: session.progress,
        currentTask: session.currentTask,
        totalTasks: session.totalTasks,
        completedTasks: session.completedTasks,
        failedTasks: session.failedTasks,
        totalFilesCopied: session.totalFilesCopied,
        errors: session.errors,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration
      }
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Log export event with details
 * @param {string} exportId - Export ID
 * @param {string} message - Log message
 * @param {Object} details - Event details
 */
function logExportEvent(exportId, message, details) {
  info(`Export ${exportId}: ${message}`, details);
}

/**
 * Update task export status (simplified)
 * @param {Array} taskIds - Task IDs
 * @param {string} status - New export status
 */
function updateTaskExportStatus(taskIds, status) {
  if (!taskIds || taskIds.length === 0) {
    return;
  }
  
  const updates = taskIds.map(taskId => ({
    taskId: taskId,
    updates: { 
      exportStatus: status,
      exportTime: new Date().toISOString()
    }
  }));
  
  try {
    batchUpdateTasksOptimized(updates);
    debug('Updated task export status', {
      taskCount: taskIds.length,
      status: status
    });
  } catch (err) {
    error('Failed to update task export status', {
      taskCount: taskIds.length,
      status: status,
      error: err.message
    });
  }
}

/**
 * Get failed export tasks for retry
 * @returns {Array} Failed tasks
 */
function getFailedExportTasks() {
  try {
    const tasks = queryTasks({
      exportStatus: EXPORT_STATUS_VALUES.DELIVERY_FAILED
    });
    
    return tasks.map(task => ({
      taskId: task.taskId,
      folderName: task.folderName,
      exportTime: task.exportTime,
      agentEmail: task.agentEmail
    }));
    
  } catch (err) {
    error('Failed to get failed export tasks', { error: err.message });
    return [];
  }
}

/**
 * Reset failed exports back to null status for retry
 * @param {Array} taskIds - Optional specific task IDs
 * @returns {Object} Reset result
 */
function resetFailedExports(taskIds = null) {
  try {
    let tasksToReset;
    
    if (taskIds && taskIds.length > 0) {
      tasksToReset = taskIds;
    } else {
      // Get all failed tasks
      const failedTasks = getFailedExportTasks();
      tasksToReset = failedTasks.map(t => t.taskId);
    }
    
    if (tasksToReset.length === 0) {
      return {
        success: true,
        message: 'No failed exports to reset',
        resetCount: 0
      };
    }
    
    // Reset to null status
    updateTaskExportStatus(tasksToReset, EXPORT_STATUS_VALUES.NULL);
    
    info('Reset failed exports', {
      resetCount: tasksToReset.length,
      taskIds: tasksToReset
    });
    
    return {
      success: true,
      message: `Reset ${tasksToReset.length} failed exports`,
      resetCount: tasksToReset.length
    };
    
  } catch (err) {
    error('Failed to reset failed exports', { error: err.message });
    return {
      success: false,
      error: err.message,
      resetCount: 0
    };
  }
}

// UI Handler Functions for Wizard

/**
 * Get available export batches for export wizard UI
 * @returns {Object} Available export batches with UI metadata
 */
function getAvailableExportBatchesForUI() {
  try {
    info('Getting export batches for UI');
    
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return {
        success: true,
        batches: [],
        summary: {
          total: 0,
          withFailures: 0,
          totalTasks: 0
        }
      };
    }
    
    // Build column index map
    const columns = {};
    COLUMN_ORDER.forEach(key => {
      columns[key] = getColumnIndex(key) - 1;
    });
    
    const batches = {};
    
    // Find all tasks with export batch IDs and relevant statuses
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const exportBatchId = row[columns.EXPORT_BATCH_ID];
      const exportStatus = row[columns.EXPORT_STATUS];
      
      // Only include batches with staged or delivery_failed tasks
      if (exportBatchId && 
          (exportStatus === EXPORT_STATUS_VALUES.STAGED || 
           exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED)) {
        
        if (!batches[exportBatchId]) {
          batches[exportBatchId] = {
            exportBatchId: exportBatchId,
            totalTasks: 0,
            stagedTasks: 0,
            failedTasks: 0,
            deliveredTasks: 0,
            createdDate: null,
            lastActivity: null,
            needsAttention: false
          };
        }
        
        const batch = batches[exportBatchId];
        batch.totalTasks++;
        
        // Count by export status
        if (exportStatus === EXPORT_STATUS_VALUES.STAGED) {
          batch.stagedTasks++;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED) {
          batch.failedTasks++;
          batch.needsAttention = true;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERED) {
          batch.deliveredTasks++;
        }
        
        // Track dates (using export time or import time as fallback)
        const exportTime = row[columns.EXPORT_TIME];
        const importTime = row[columns.IMPORT_TIME];
        const relevantTime = exportTime || importTime;
        
        if (relevantTime) {
          const date = new Date(relevantTime);
          if (!batch.createdDate || date < batch.createdDate) {
            batch.createdDate = date;
          }
          if (!batch.lastActivity || date > batch.lastActivity) {
            batch.lastActivity = date;
          }
        }
      }
    }
    
    // Convert to array and sort by last activity (newest first)
    const batchArray = Object.values(batches)
      .filter(batch => batch.stagedTasks > 0 || batch.failedTasks > 0)
      .sort((a, b) => {
        const dateA = a.lastActivity || a.createdDate || new Date(0);
        const dateB = b.lastActivity || b.createdDate || new Date(0);
        return dateB - dateA;
      });
    
    info('Found available export batches for UI', {
      totalBatches: batchArray.length,
      withFailures: batchArray.filter(b => b.needsAttention).length
    });
    
    return {
      success: true,
      batches: batchArray,
      summary: {
        total: batchArray.length,
        withFailures: batchArray.filter(b => b.needsAttention).length,
        totalTasks: batchArray.reduce((sum, b) => sum + b.totalTasks, 0)
      }
    };
    
  } catch (err) {
    error('Failed to get export batches for UI', { error: err.message });
    return {
      success: false,
      error: err.message,
      batches: []
    };
  }
}

/**
 * Start export wizard operation by batch
 * @param {string} exportBatchId - Export batch ID
 * @param {string} clientFolderId - Client folder ID
 * @returns {Object} Export operation result
 */
function startExportWizard(exportBatchId, clientFolderId) {
  if (!exportBatchId) {
    return {
      success: false,
      error: 'Export batch ID is required'
    };
  }
  
  if (!clientFolderId) {
    return {
      success: false,
      error: 'Client folder ID is required'
    };
  }
  
  info('Starting export wizard for batch', {
    exportBatchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  return executeExport(exportBatchId, clientFolderId);
}

/**
 * Get export results for wizard display
 * @param {string} exportId - Export ID
 * @returns {Object} Export results
 */
function getExportResults(exportId) {
  return getExportProgress(exportId);
}