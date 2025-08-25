/**
 * Delivery UI Handlers
 * Server-side functions for delivery wizard UI
 */

/**
 * Get deliverable batches formatted for UI display
 * @returns {Object} Batches with UI metadata
 */
function getDeliverableBatchesForUI() {
  try {
    info('Getting deliverable batches for UI');
    
    const batches = getDeliverableBatches();
    
    if (batches.length === 0) {
      return {
        success: true,
        batches: [],
        summary: {
          total: 0,
          totalTasks: 0
        }
      };
    }
    
    // Calculate summary
    const summary = {
      total: batches.length,
      totalTasks: batches.reduce((sum, b) => sum + b.totalTasks, 0)
    };
    
    info('Found deliverable batches for UI', {
      totalBatches: batches.length,
      totalTasks: summary.totalTasks
    });
    
    return {
      success: true,
      batches: batches,
      summary: summary
    };
    
  } catch (err) {
    error('Failed to get deliverable batches for UI', { error: err.message });
    return {
      success: false,
      error: err.message,
      batches: []
    };
  }
}

/**
 * Check for resumable delivery
 * @returns {Object} Resume information for UI
 */
function checkForResumeUI() {
  try {
    const resumeInfo = checkDeliveryResume();
    
    return {
      success: true,
      ...resumeInfo
    };
    
  } catch (err) {
    error('Failed to check for resume', { error: err.message });
    return {
      success: false,
      hasResume: false
    };
  }
}

/**
 * Start delivery wizard operation
 * @param {string} exportBatchId - Export batch ID to deliver
 * @param {string} clientFolderId - Client folder ID
 * @returns {Object} Delivery operation result
 */
function startDeliveryWizard(exportBatchId, clientFolderId) {
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
  
  info('Starting delivery wizard', {
    exportBatchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  try {
    // First validate the client folder
    const validation = validateDeliveryFolder(clientFolderId, exportBatchId);
    if (!validation.valid) {
      return {
        success: false,
        error: `Client folder validation failed: ${validation.error}`
      };
    }
    
    // Execute the delivery
    const result = executeDelivery(exportBatchId, clientFolderId);
    
    // Add client folder info to result
    result.clientFolder = validation;
    
    return result;
    
  } catch (err) {
    error('Delivery wizard failed', {
      exportBatchId: exportBatchId,
      error: err.message
    });
    
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Resume previous delivery operation
 * @param {string} clientFolderId - Client folder ID
 * @returns {Object} Resume operation result
 */
function resumeDeliveryWizard(clientFolderId) {
  if (!clientFolderId) {
    return {
      success: false,
      error: 'Client folder ID is required'
    };
  }
  
  info('Resuming delivery wizard', {
    clientFolder: clientFolderId
  });
  
  try {
    // Get tasks in delivering status to determine batch
    const deliveringTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERING);
    
    if (deliveringTasks.length === 0) {
      return {
        success: false,
        error: 'No delivery to resume'
      };
    }
    
    // Reset all delivering tasks to staged so we can restart cleanly
    const taskIds = deliveringTasks.map(t => t.taskId);
    updateTaskExportStatus(taskIds, EXPORT_STATUS_VALUES.STAGED);
    
    // Get the batch ID from the first task (they should all be the same batch)
    const exportBatchId = deliveringTasks[0].exportBatchId;
    
    if (!exportBatchId) {
      return {
        success: false,
        error: 'Cannot determine batch ID for resume'
      };
    }
    
    // Now start delivery normally
    return startDeliveryWizard(exportBatchId, clientFolderId);
    
  } catch (err) {
    error('Resume delivery failed', {
      error: err.message
    });
    
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Validate delivery folder with UI-friendly response
 * @param {string} folderId - Client folder ID
 * @param {string} exportBatchId - Optional export batch ID for sampling
 * @returns {Object} Validation result for UI
 */
function validateDeliveryFolderUI(folderId, exportBatchId = null) {
  try {
    const result = validateDeliveryFolder(folderId, exportBatchId);
    
    return {
      success: true,
      validation: result
    };
    
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Get delivery batch details for UI
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Batch details
 */
function getDeliveryBatchDetailsUI(exportBatchId) {
  try {
    if (!exportBatchId) {
      return {
        success: false,
        error: 'Batch ID is required'
      };
    }
    
    // Get tasks for this batch
    const stagedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGED, exportBatchId);
    const failedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED, exportBatchId);
    const deliveredTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERED, exportBatchId);
    
    const details = {
      batchId: exportBatchId,
      totalTasks: stagedTasks.length + failedTasks.length + deliveredTasks.length,
      deliverableTasks: stagedTasks.length + failedTasks.length,
      stagedTasks: stagedTasks.length,
      failedTasks: failedTasks.length,
      deliveredTasks: deliveredTasks.length,
      sampleTaskNames: stagedTasks.concat(failedTasks).slice(0, 5).map(t => t.folderName)
    };
    
    return {
      success: true,
      details: details
    };
    
  } catch (err) {
    error('Failed to get batch details', { 
      batchId: exportBatchId,
      error: err.message 
    });
    
    return {
      success: false,
      error: err.message
    };
  }
}