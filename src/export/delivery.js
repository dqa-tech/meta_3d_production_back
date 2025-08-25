/**
 * Simple Delivery System - Core Logic
 * Handles direct delivery of staged tasks to client folders
 */

/**
 * Get export batches that have deliverable tasks
 * @returns {Array} Batches with staged or delivery_failed tasks
 */
function getDeliverableBatches() {
  console.log('DEBUG: Starting getDeliverableBatches');
  info('Getting deliverable export batches');
  
  try {
    console.log('DEBUG: Getting sheet...');
    const sheet = getTasksSheet();
    console.log('DEBUG: Sheet obtained:', sheet ? 'OK' : 'NULL');
    
    console.log('DEBUG: Getting data range...');
    const data = sheet.getDataRange().getValues();
    console.log('DEBUG: Data rows:', data.length);
    
    if (data.length <= 1) {
      console.log('DEBUG: No data rows, returning empty');
      return [];
    }
    
    // Build column index map
    console.log('DEBUG: Building column map...');
    const columns = {};
    COLUMN_ORDER.forEach(key => {
      const index = getColumnIndex(key);
      columns[key] = index - 1;
      console.log(`DEBUG: Column ${key} = index ${index} (array pos ${index - 1})`);
    });
    
    console.log('DEBUG: Key columns - EXPORT_BATCH_ID:', columns.EXPORT_BATCH_ID, 'EXPORT_STATUS:', columns.EXPORT_STATUS);
    
    const batches = {};
    console.log('DEBUG: Starting to process rows...');
    console.log('DEBUG: EXPORT_STATUS_VALUES.STAGED =', EXPORT_STATUS_VALUES.STAGED);
    console.log('DEBUG: EXPORT_STATUS_VALUES.DELIVERY_FAILED =', EXPORT_STATUS_VALUES.DELIVERY_FAILED);
    
    let matchingRows = 0;
    
    // Find all tasks with export batch IDs and deliverable statuses
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const exportBatchId = row[columns.EXPORT_BATCH_ID];
      const exportStatus = row[columns.EXPORT_STATUS];
      
      if (i <= 3) { // Log first few rows for debugging
        console.log(`DEBUG: Row ${i} - exportBatchId: "${exportBatchId}", exportStatus: "${exportStatus}"`);
      }
      
      // Only include batches with staged or delivery_failed tasks
      if (exportBatchId && 
          (exportStatus === EXPORT_STATUS_VALUES.STAGED || 
           exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED)) {
        
        matchingRows++;
        console.log(`DEBUG: Found matching row ${i} - batch: ${exportBatchId}, status: ${exportStatus}`);
        
        if (!batches[exportBatchId]) {
          batches[exportBatchId] = {
            exportBatchId: exportBatchId,
            totalTasks: 0,
            stagedTasks: 0,
            failedTasks: 0,
            deliveredTasks: 0,
            createdDate: null
          };
        }
        
        const batch = batches[exportBatchId];
        batch.totalTasks++;
        
        if (exportStatus === EXPORT_STATUS_VALUES.STAGED) {
          batch.stagedTasks++;
        } else if (exportStatus === EXPORT_STATUS_VALUES.DELIVERY_FAILED) {
          batch.failedTasks++;
        }
        
        // Track creation date (store as ISO string for serialization)
        const exportTime = row[columns.EXPORT_TIME];
        if (exportTime) {
          const date = new Date(exportTime);
          const dateString = date.toISOString();
          if (!batch.createdDate || date < new Date(batch.createdDate)) {
            batch.createdDate = dateString;
          }
        }
      }
    }
    
    console.log(`DEBUG: Processing complete. Found ${matchingRows} matching rows`);
    console.log(`DEBUG: Batches object:`, Object.keys(batches));
    
    // Convert to array and sort by date (newest first)
    const batchArray = Object.values(batches)
      .filter(batch => batch.stagedTasks > 0 || batch.failedTasks > 0)
      .sort((a, b) => {
        const dateA = a.createdDate ? new Date(a.createdDate) : new Date(0);
        const dateB = b.createdDate ? new Date(b.createdDate) : new Date(0);
        return dateB - dateA;
      });
    
    console.log(`DEBUG: Final batchArray length:`, batchArray.length);
    console.log(`DEBUG: Final batches:`, batchArray.map(b => ({id: b.exportBatchId, staged: b.stagedTasks, failed: b.failedTasks})));
    
    info('Found deliverable batches', {
      totalBatches: batchArray.length
    });
    
    return batchArray;
    
  } catch (err) {
    console.log('DEBUG: ERROR in getDeliverableBatches:', err);
    console.log('DEBUG: Error message:', err.message);
    console.log('DEBUG: Error stack:', err.stack);
    error('Failed to get deliverable batches', { error: err.message });
    throw new Error(`Failed to get deliverable batches: ${err.message}`);
  }
}

/**
 * Validate client delivery folder and check sample task folders
 * @param {string} folderId - Client folder ID
 * @param {string} exportBatchId - Export batch ID to sample from
 * @returns {Object} Validation result
 */
function validateDeliveryFolder(folderId, exportBatchId) {
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
    // Check folder access and get name
    const folder = DriveApp.getFolderById(folderId);
    const folderName = folder.getName();
    
    // Test write access
    const testFile = DriveApp.createFile('__delivery_test__.txt', 'test');
    folder.addFile(testFile);
    testFile.setTrashed(true);
    
    // Get sample of task folder names from batch
    let sampleTaskFolders = [];
    let totalBatchTasks = 0;
    
    if (exportBatchId) {
      const batchTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGED, exportBatchId)
        .concat(getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED, exportBatchId));
      
      totalBatchTasks = batchTasks.length;
      sampleTaskFolders = batchTasks.slice(0, Math.min(10, batchTasks.length))
        .map(task => task.folderName);
    }
    
    // Check how many sample folders exist in client folder
    let matchedFolders = 0;
    if (sampleTaskFolders.length > 0) {
      for (const taskFolderName of sampleTaskFolders) {
        const taskFolders = folder.getFoldersByName(taskFolderName);
        if (taskFolders.hasNext()) {
          matchedFolders++;
        }
      }
    }
    
    info('Client folder validated', {
      folderId: folderId,
      folderName: folderName,
      sampledTasks: sampleTaskFolders.length,
      matchedFolders: matchedFolders
    });
    
    return {
      valid: true,
      folderId: folderId,
      folderName: folderName,
      folderUrl: folder.getUrl(),
      sampleValidation: {
        totalBatchTasks: totalBatchTasks,
        sampledTasks: sampleTaskFolders.length,
        matchedFolders: matchedFolders,
        matchPercentage: sampleTaskFolders.length > 0 ? 
          Math.round((matchedFolders / sampleTaskFolders.length) * 100) : 100
      }
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
 * Check if there's a delivery to resume
 * @returns {Object} Resume information
 */
function checkDeliveryResume() {
  try {
    // Get tasks in delivering status
    const deliveringTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERING);
    
    if (deliveringTasks.length === 0) {
      return {
        hasResume: false
      };
    }
    
    // Group by batch
    const batchInfo = {};
    deliveringTasks.forEach(task => {
      const batchId = task.exportBatchId || 'unknown';
      if (!batchInfo[batchId]) {
        batchInfo[batchId] = {
          batchId: batchId,
          taskCount: 0
        };
      }
      batchInfo[batchId].taskCount++;
    });
    
    return {
      hasResume: true,
      totalTasks: deliveringTasks.length,
      batches: Object.values(batchInfo)
    };
    
  } catch (err) {
    error('Failed to check delivery resume', { error: err.message });
    return { hasResume: false };
  }
}

/**
 * Execute delivery operation with timeout handling
 * @param {string} exportBatchId - Export batch ID to deliver
 * @param {string} clientFolderId - Client destination folder ID
 * @returns {Object} Delivery results
 */
function executeDelivery(exportBatchId, clientFolderId) {
  const startTime = new Date();
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  info('Starting delivery operation', {
    exportBatchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  try {
    // Get deliverable tasks (staged + delivery_failed)
    const stagedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGED, exportBatchId);
    const failedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED, exportBatchId);
    const tasks = [...stagedTasks, ...failedTasks];
    
    if (tasks.length === 0) {
      throw new Error(`No deliverable tasks found in batch ${exportBatchId}`);
    }
    
    const taskIds = tasks.map(task => task.taskId);
    
    info('Found deliverable tasks', {
      batchId: exportBatchId,
      taskCount: tasks.length,
      staged: stagedTasks.length,
      failed: failedTasks.length
    });
    
    // Mark all tasks as delivering
    updateTaskExportStatus(taskIds, EXPORT_STATUS_VALUES.DELIVERING);
    
    let delivered = 0;
    let failed = 0;
    const errors = [];
    
    // Process each task
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      
      // Check timeout
      if (new Date() - startTime > TIMEOUT_MS) {
        // Reset remaining unprocessed tasks back to staged
        const remainingTasks = tasks.slice(i);
        const remainingIds = remainingTasks.map(t => t.taskId);
        updateTaskExportStatus(remainingIds, EXPORT_STATUS_VALUES.STAGED);
        
        info('Delivery timed out - remaining tasks reset to staged', {
          processed: i,
          remaining: remainingTasks.length,
          delivered: delivered,
          failed: failed
        });
        
        return {
          success: true,
          partial: true,
          delivered: delivered,
          failed: failed,
          remaining: remainingTasks.length,
          totalTasks: tasks.length,
          message: `Delivered ${delivered} of ${tasks.length} tasks. Time limit reached. Reopen delivery wizard to continue.`,
          errors: errors
        };
      }
      
      // Deliver this task
      try {
        const result = deliverTaskFiles(task, clientFolderId);
        
        if (result.success) {
          updateTaskExportStatus([task.taskId], EXPORT_STATUS_VALUES.DELIVERED);
          delivered++;
          
          // Progress logging every 25 tasks
          if (delivered % 25 === 0) {
            console.log(`Delivery progress: ${delivered} tasks completed`);
          }
          
        } else {
          updateTaskExportStatus([task.taskId], EXPORT_STATUS_VALUES.DELIVERY_FAILED);
          failed++;
          errors.push({
            taskId: task.taskId,
            folderName: task.folderName,
            error: result.error
          });
        }
        
      } catch (taskError) {
        updateTaskExportStatus([task.taskId], EXPORT_STATUS_VALUES.DELIVERY_FAILED);
        failed++;
        errors.push({
          taskId: task.taskId,
          folderName: task.folderName,
          error: taskError.message
        });
      }
    }
    
    const summary = {
      success: failed === 0,
      delivered: delivered,
      failed: failed,
      totalTasks: tasks.length,
      duration: new Date() - startTime,
      errors: errors
    };
    
    info('Delivery operation completed', summary);
    return summary;
    
  } catch (err) {
    error('Delivery operation failed', {
      exportBatchId: exportBatchId,
      error: err.message
    });
    
    return {
      success: false,
      error: err.message,
      delivered: 0,
      failed: 0,
      totalTasks: 0
    };
  }
}

/**
 * Deliver files for a single task to client folder
 * @param {Object} task - Task object
 * @param {string} clientFolderId - Client base folder ID
 * @returns {Object} Delivery result
 */
function deliverTaskFiles(task, clientFolderId) {
  try {
    // Get production folder
    if (!task.productionFolderLink) {
      return {
        success: false,
        error: 'No production folder available'
      };
    }
    
    // Extract folder ID from URL if needed
    let productionFolderId = task.productionFolderLink;
    const urlMatch = productionFolderId.match(/[-\w]{25,}/);
    if (urlMatch) {
      productionFolderId = urlMatch[0];
    }
    
    const prodFolder = DriveApp.getFolderById(productionFolderId);
    
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
    
    // Get files from production folder and copy (excluding base images)
    const excludeFiles = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];
    const files = prodFolder.getFiles();
    let copiedCount = 0;
    const copiedFiles = [];
    const fileErrors = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      
      // Skip original input files
      if (excludeFiles.includes(fileName.toLowerCase())) {
        continue;
      }
      
      try {
        const copiedFile = file.makeCopy(fileName, targetFolder);
        copiedFiles.push(fileName);
        copiedCount++;
        
      } catch (fileError) {
        fileErrors.push(`${fileName}: ${fileError.message}`);
      }
    }
    
    if (copiedCount === 0) {
      return {
        success: false,
        error: 'No production files found to copy'
      };
    }
    
    return {
      success: true,
      filesCopied: copiedCount,
      copiedFiles: copiedFiles,
      errors: fileErrors.length > 0 ? fileErrors : null
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}