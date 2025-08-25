/**
 * Export recovery operations
 * Handles recovery and retry of failed export operations
 */

/**
 * Resume failed staging operation
 * @param {string} exportBatchId - Export batch ID to resume
 * @returns {Object} Resume results
 */
function resumeFailedStaging(exportBatchId) {
  const startTime = new Date();
  
  info('Resuming failed staging operation', {
    batchId: exportBatchId
  });
  
  try {
    if (!exportBatchId) {
      throw new ValidationError('Export batch ID is required');
    }
    
    // Find tasks stuck in 'staging' status
    const stagingTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING, exportBatchId);
    
    if (stagingTasks.length === 0) {
      return {
        success: true,
        message: 'No tasks in staging status to resume',
        resumedTasks: 0,
        exportBatchId: exportBatchId
      };
    }
    
    info('Found tasks to resume staging', {
      batchId: exportBatchId,
      taskCount: stagingTasks.length
    });
    
    // Get staging configuration
    const stagingConfig = getStagingConfiguration();
    if (!stagingConfig.isValid) {
      throw new Error('Staging folder not accessible');
    }
    
    // Find existing staging batch folder
    const batchFolder = findStagingBatchFolder(exportBatchId);
    if (!batchFolder) {
      // Recreate batch folder if missing
      const newBatchFolder = createStagingBatchFolder(stagingConfig.folderId, exportBatchId);
      info('Recreated missing staging batch folder', {
        batchId: exportBatchId,
        folderId: newBatchFolder.id
      });
    }
    
    // Resume staging for stuck tasks
    const resumeResults = processTasksForStaging(stagingTasks, batchFolder.id, exportBatchId);
    
    // Count successful resumes
    const successfulCount = resumeResults.filter(r => r.success).length;
    const failedCount = resumeResults.filter(r => !r.success).length;
    
    const duration = new Date() - startTime;
    const result = {
      success: failedCount === 0,
      message: `Resumed ${successfulCount} tasks successfully, ${failedCount} failed`,
      exportBatchId: exportBatchId,
      resumedTasks: successfulCount,
      failedTasks: failedCount,
      duration: duration,
      results: resumeResults
    };
    
    info('Staging resume completed', {
      batchId: exportBatchId,
      success: result.success,
      resumedTasks: successfulCount,
      failedTasks: failedCount,
      duration: duration
    });
    
    return result;
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to resume staging', {
      batchId: exportBatchId,
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      exportBatchId: exportBatchId,
      resumedTasks: 0,
      duration: duration
    };
  }
}

/**
 * Retry failed staging tasks
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Retry results
 */
function retryFailedStagingTasks(exportBatchId) {
  const startTime = new Date();
  
  info('Retrying failed staging tasks', {
    batchId: exportBatchId
  });
  
  try {
    if (!exportBatchId) {
      throw new ValidationError('Export batch ID is required');
    }
    
    // Find tasks with staging_failed status
    const failedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING_FAILED, exportBatchId);
    
    if (failedTasks.length === 0) {
      return {
        success: true,
        message: 'No failed staging tasks to retry',
        retriedTasks: 0,
        exportBatchId: exportBatchId
      };
    }
    
    info('Found failed staging tasks to retry', {
      batchId: exportBatchId,
      taskCount: failedTasks.length
    });
    
    // Reset failed tasks back to staging status for retry
    updateTaskExportStatus(
      failedTasks.map(t => t.taskId),
      EXPORT_STATUS_VALUES.STAGING,
      exportBatchId
    );
    
    // Retry staging operation
    const resumeResult = resumeFailedStaging(exportBatchId);
    
    const duration = new Date() - startTime;
    const result = {
      success: resumeResult.success,
      message: `Retried ${failedTasks.length} failed tasks: ${resumeResult.message}`,
      exportBatchId: exportBatchId,
      retriedTasks: failedTasks.length,
      resumeResult: resumeResult,
      duration: duration
    };
    
    info('Staging retry completed', {
      batchId: exportBatchId,
      retriedTasks: failedTasks.length,
      success: result.success,
      duration: duration
    });
    
    return result;
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to retry staging tasks', {
      batchId: exportBatchId,
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      exportBatchId: exportBatchId,
      retriedTasks: 0,
      duration: duration
    };
  }
}

/**
 * Resume failed delivery operation (enhanced version)
 * @param {string} exportBatchId - Export batch ID
 * @param {string} clientFolderId - Client folder ID (optional, will try to detect)
 * @returns {Object} Resume results
 */
function resumeFailedDelivery(exportBatchId, clientFolderId = null) {
  const startTime = new Date();
  
  info('Resuming failed delivery operation', {
    batchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  try {
    if (!exportBatchId) {
      throw new ValidationError('Export batch ID is required');
    }
    
    // Find tasks stuck in 'delivering' status
    const deliveringTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERING, exportBatchId);
    
    if (deliveringTasks.length === 0) {
      return {
        success: true,
        message: 'No tasks in delivering status to resume',
        resumedTasks: 0,
        exportBatchId: exportBatchId
      };
    }
    
    info('Found tasks to resume delivery', {
      batchId: exportBatchId,
      taskCount: deliveringTasks.length
    });
    
    // If no client folder provided, try to detect from previous delivery attempt
    if (!clientFolderId) {
      clientFolderId = detectClientFolderFromBatch(exportBatchId);
      if (!clientFolderId) {
        throw new ValidationError('Client folder ID required for delivery resume');
      }
    }
    
    // Reset delivering tasks back to staged for retry
    updateTaskExportStatus(
      deliveringTasks.map(t => t.taskId),
      EXPORT_STATUS_VALUES.STAGED,
      exportBatchId
    );
    
    // Execute delivery operation
    const deliveryResult = executeDeliveryOperation(exportBatchId, clientFolderId);
    
    const duration = new Date() - startTime;
    const result = {
      success: deliveryResult.success,
      message: `Resumed delivery for ${deliveringTasks.length} tasks`,
      exportBatchId: exportBatchId,
      resumedTasks: deliveringTasks.length,
      deliveryResult: deliveryResult,
      duration: duration
    };
    
    info('Delivery resume completed', {
      batchId: exportBatchId,
      success: result.success,
      resumedTasks: deliveringTasks.length,
      duration: duration
    });
    
    return result;
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to resume delivery', {
      batchId: exportBatchId,
      clientFolder: clientFolderId,
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      exportBatchId: exportBatchId,
      resumedTasks: 0,
      duration: duration
    };
  }
}

/**
 * Retry failed delivery tasks
 * @param {string} exportBatchId - Export batch ID
 * @param {string} clientFolderId - Client folder ID
 * @returns {Object} Retry results
 */
function retryFailedDelivery(exportBatchId, clientFolderId) {
  const startTime = new Date();
  
  info('Retrying failed delivery tasks', {
    batchId: exportBatchId,
    clientFolder: clientFolderId
  });
  
  try {
    if (!exportBatchId) {
      throw new ValidationError('Export batch ID is required');
    }
    
    if (!clientFolderId) {
      throw new ValidationError('Client folder ID is required');
    }
    
    // Find tasks with delivery_failed status
    const failedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED, exportBatchId);
    
    if (failedTasks.length === 0) {
      return {
        success: true,
        message: 'No failed delivery tasks to retry',
        retriedTasks: 0,
        exportBatchId: exportBatchId
      };
    }
    
    info('Found failed delivery tasks to retry', {
      batchId: exportBatchId,
      taskCount: failedTasks.length
    });
    
    // Reset failed tasks back to staged status for retry
    updateTaskExportStatus(
      failedTasks.map(t => t.taskId),
      EXPORT_STATUS_VALUES.STAGED,
      exportBatchId
    );
    
    // Retry delivery operation
    const deliveryResult = executeDeliveryOperation(exportBatchId, clientFolderId);
    
    const duration = new Date() - startTime;
    const result = {
      success: deliveryResult.success,
      message: `Retried ${failedTasks.length} failed delivery tasks`,
      exportBatchId: exportBatchId,
      retriedTasks: failedTasks.length,
      deliveryResult: deliveryResult,
      duration: duration
    };
    
    info('Delivery retry completed', {
      batchId: exportBatchId,
      retriedTasks: failedTasks.length,
      success: result.success,
      duration: duration
    });
    
    return result;
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to retry delivery tasks', {
      batchId: exportBatchId,
      clientFolder: clientFolderId,
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      exportBatchId: exportBatchId,
      retriedTasks: 0,
      duration: duration
    };
  }
}

/**
 * Detect client folder from previous delivery attempts
 * @param {string} exportBatchId - Export batch ID
 * @returns {string|null} Client folder ID if found
 */
function detectClientFolderFromBatch(exportBatchId) {
  try {
    // Look for delivered tasks in this batch to find client folder pattern
    const deliveredTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERED, exportBatchId);
    
    if (deliveredTasks.length > 0) {
      // This is a simplified approach - in a real implementation you might
      // need to store client folder IDs in the batch metadata
      warn('Cannot automatically detect client folder', {
        batchId: exportBatchId,
        message: 'Client folder detection not implemented - manual specification required'
      });
    }
    
    return null;
  } catch (error) {
    warn('Failed to detect client folder', {
      batchId: exportBatchId,
      error: error.message
    });
    return null;
  }
}

/**
 * Cleanup abandoned exports older than specified days
 * @param {number} olderThanDays - Age threshold in days
 * @returns {Object} Cleanup results
 */
function cleanupAbandonedExports(olderThanDays = 7) {
  const startTime = new Date();
  const cutoffDate = new Date(Date.now() - (olderThanDays * 24 * 60 * 60 * 1000));
  
  info('Starting abandoned export cleanup', {
    olderThanDays: olderThanDays,
    cutoffDate: cutoffDate.toISOString()
  });
  
  try {
    const cleanupResults = {
      clearedTasks: 0,
      clearedBatches: [],
      removedStagingFolders: 0,
      errors: []
    };
    
    // Find old failed staging tasks
    const abandonedStagingTasks = findAbandonedTasks(
      [EXPORT_STATUS_VALUES.STAGING, EXPORT_STATUS_VALUES.STAGING_FAILED],
      cutoffDate
    );
    
    // Find old failed delivery tasks
    const abandonedDeliveryTasks = findAbandonedTasks(
      [EXPORT_STATUS_VALUES.DELIVERING, EXPORT_STATUS_VALUES.DELIVERY_FAILED],
      cutoffDate
    );
    
    const allAbandonedTasks = [...abandonedStagingTasks, ...abandonedDeliveryTasks];
    
    if (allAbandonedTasks.length === 0) {
      return {
        success: true,
        message: 'No abandoned exports found to cleanup',
        cleanupResults: cleanupResults,
        duration: new Date() - startTime
      };
    }
    
    info('Found abandoned export tasks', {
      stagingTasks: abandonedStagingTasks.length,
      deliveryTasks: abandonedDeliveryTasks.length,
      totalTasks: allAbandonedTasks.length
    });
    
    // Group by export batch ID
    const batchGroups = groupTasksByBatch(allAbandonedTasks);
    
    // Process each abandoned batch
    Object.entries(batchGroups).forEach(([batchId, tasks]) => {
      try {
        const cleanupResult = cleanupExportBatch(batchId, tasks, cutoffDate);
        
        if (cleanupResult.success) {
          cleanupResults.clearedTasks += cleanupResult.clearedTasks;
          cleanupResults.clearedBatches.push(batchId);
          if (cleanupResult.removedStagingFolder) {
            cleanupResults.removedStagingFolders++;
          }
        } else {
          cleanupResults.errors.push(`Batch ${batchId}: ${cleanupResult.error}`);
        }
      } catch (error) {
        cleanupResults.errors.push(`Batch ${batchId}: ${error.message}`);
      }
    });
    
    const duration = new Date() - startTime;
    const result = {
      success: cleanupResults.errors.length === 0,
      message: `Cleaned up ${cleanupResults.clearedTasks} tasks from ${cleanupResults.clearedBatches.length} batches`,
      cleanupResults: cleanupResults,
      duration: duration
    };
    
    info('Abandoned export cleanup completed', {
      success: result.success,
      clearedTasks: cleanupResults.clearedTasks,
      clearedBatches: cleanupResults.clearedBatches.length,
      errors: cleanupResults.errors.length,
      duration: duration
    });
    
    return result;
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to cleanup abandoned exports', {
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      duration: duration
    };
  }
}

/**
 * Find abandoned tasks by status and age
 * @param {Array} statuses - Export statuses to search for
 * @param {Date} cutoffDate - Age cutoff date
 * @returns {Array} Abandoned tasks
 */
function findAbandonedTasks(statuses, cutoffDate) {
  const abandonedTasks = [];
  
  statuses.forEach(status => {
    const tasks = getTasksByExportStatus(status);
    
    tasks.forEach(task => {
      // Check if task is old enough
      const taskDate = task.exportTime ? new Date(task.exportTime) : new Date(task.importTime);
      
      if (taskDate < cutoffDate) {
        abandonedTasks.push({
          ...task,
          abandonedStatus: status,
          taskAge: Math.round((Date.now() - taskDate.getTime()) / (24 * 60 * 60 * 1000))
        });
      }
    });
  });
  
  return abandonedTasks;
}

/**
 * Group tasks by export batch ID
 * @param {Array} tasks - Tasks to group
 * @returns {Object} Tasks grouped by batch ID
 */
function groupTasksByBatch(tasks) {
  const groups = {};
  
  tasks.forEach(task => {
    const batchId = task.exportBatchId || 'no_batch';
    if (!groups[batchId]) {
      groups[batchId] = [];
    }
    groups[batchId].push(task);
  });
  
  return groups;
}

/**
 * Cleanup specific export batch
 * @param {string} batchId - Export batch ID
 * @param {Array} tasks - Tasks in batch to cleanup
 * @param {Date} cutoffDate - Age cutoff date
 * @returns {Object} Cleanup result for batch
 */
function cleanupExportBatch(batchId, tasks, cutoffDate) {
  try {
    info('Cleaning up export batch', {
      batchId: batchId,
      taskCount: tasks.length
    });
    
    // Reset task export statuses
    const taskIds = tasks.map(t => t.taskId);
    updateTaskExportStatus(taskIds, EXPORT_STATUS_VALUES.NULL);
    
    // Clear export batch IDs and staged counts
    const updates = taskIds.map(taskId => ({
      taskId: taskId,
      updates: {
        exportBatchId: '',
        stagedCount: '',
        exportTime: ''
      }
    }));
    
    batchUpdateTasksOptimized(updates);
    
    // Try to remove staging folder if it exists and is empty
    let removedStagingFolder = false;
    try {
      const stagingBatchFolder = findStagingBatchFolder(batchId);
      if (stagingBatchFolder) {
        const folderContents = listFiles(stagingBatchFolder.id);
        const subfolders = listFolders(stagingBatchFolder.id);
        
        // Only remove if relatively empty (just export sheets)
        if (folderContents.length <= 1 && subfolders.length === 0) {
          DriveApp.getFolderById(stagingBatchFolder.id).setTrashed(true);
          removedStagingFolder = true;
          info('Removed empty staging folder', {
            batchId: batchId,
            folderId: stagingBatchFolder.id
          });
        }
      }
    } catch (folderError) {
      // Don't fail the whole cleanup if folder removal fails
      warn('Failed to remove staging folder', {
        batchId: batchId,
        error: folderError.message
      });
    }
    
    return {
      success: true,
      clearedTasks: tasks.length,
      removedStagingFolder: removedStagingFolder
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Reset export status for tasks (manual admin override)
 * @param {Array} taskIds - Task IDs to reset
 * @param {string} newStatus - New export status
 * @param {string} reason - Reason for reset
 * @returns {Object} Reset results
 */
function resetExportStatus(taskIds, newStatus, reason) {
  try {
    if (!taskIds || taskIds.length === 0) {
      throw new ValidationError('Task IDs are required');
    }
    
    if (!Object.values(EXPORT_STATUS_VALUES).includes(newStatus)) {
      throw new ValidationError('Invalid export status');
    }
    
    if (!reason || reason.trim().length === 0) {
      throw new ValidationError('Reason for reset is required');
    }
    
    info('Resetting export status', {
      taskCount: taskIds.length,
      newStatus: newStatus,
      reason: reason
    });
    
    // Update export status
    const result = updateTaskExportStatus(taskIds, newStatus);
    
    // If resetting to null, clear related fields
    if (newStatus === EXPORT_STATUS_VALUES.NULL) {
      const updates = taskIds.map(taskId => ({
        taskId: taskId,
        updates: {
          exportBatchId: '',
          stagedCount: '',
          exportTime: ''
        }
      }));
      
      batchUpdateTasksOptimized(updates);
    }
    
    // Log the administrative action
    taskIds.forEach(taskId => {
      info('Export status reset', {
        taskId: taskId,
        newStatus: newStatus,
        reason: reason,
        timestamp: new Date().toISOString()
      });
    });
    
    return {
      success: true,
      message: `Reset ${result.updated} task(s) to status: ${newStatus}`,
      resetTasks: result.updated,
      failedResets: result.failed,
      reason: reason
    };
    
  } catch (error) {
    error('Failed to reset export status', {
      taskCount: taskIds ? taskIds.length : 0,
      newStatus: newStatus,
      reason: reason,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      resetTasks: 0
    };
  }
}

/**
 * Get recovery status for all export operations
 * @returns {Object} Recovery status summary
 */
function getRecoveryStatus() {
  try {
    const recovery = {
      stagingIssues: {
        stuck: 0,
        failed: 0,
        tasks: []
      },
      deliveryIssues: {
        stuck: 0,
        failed: 0,
        tasks: []
      },
      abandonedExports: {
        count: 0,
        oldestAge: 0,
        batches: []
      },
      recommendations: []
    };
    
    // Find staging issues
    const stuckStaging = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING);
    const failedStaging = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING_FAILED);
    
    recovery.stagingIssues.stuck = stuckStaging.length;
    recovery.stagingIssues.failed = failedStaging.length;
    recovery.stagingIssues.tasks = [...stuckStaging, ...failedStaging].slice(0, 10); // Sample
    
    // Find delivery issues
    const stuckDelivery = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERING);
    const failedDelivery = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED);
    
    recovery.deliveryIssues.stuck = stuckDelivery.length;
    recovery.deliveryIssues.failed = failedDelivery.length;
    recovery.deliveryIssues.tasks = [...stuckDelivery, ...failedDelivery].slice(0, 10); // Sample
    
    // Find abandoned exports (older than 7 days)
    const cutoffDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
    const abandoned = findAbandonedTasks([
      EXPORT_STATUS_VALUES.STAGING,
      EXPORT_STATUS_VALUES.STAGING_FAILED,
      EXPORT_STATUS_VALUES.DELIVERING,
      EXPORT_STATUS_VALUES.DELIVERY_FAILED
    ], cutoffDate);
    
    recovery.abandonedExports.count = abandoned.length;
    if (abandoned.length > 0) {
      recovery.abandonedExports.oldestAge = Math.max(...abandoned.map(t => t.taskAge));
      recovery.abandonedExports.batches = [...new Set(abandoned.map(t => t.exportBatchId))];
    }
    
    // Generate recommendations
    if (recovery.stagingIssues.stuck > 0) {
      recovery.recommendations.push('Resume stuck staging operations');
    }
    
    if (recovery.stagingIssues.failed > 0) {
      recovery.recommendations.push('Retry failed staging validations');
    }
    
    if (recovery.deliveryIssues.stuck > 0) {
      recovery.recommendations.push('Resume interrupted deliveries');
    }
    
    if (recovery.deliveryIssues.failed > 0) {
      recovery.recommendations.push('Retry failed delivery operations');
    }
    
    if (recovery.abandonedExports.count > 0) {
      recovery.recommendations.push(`Clean up ${recovery.abandonedExports.count} abandoned exports`);
    }
    
    return {
      success: true,
      recovery: recovery,
      healthScore: calculateHealthScore(recovery),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    error('Failed to get recovery status', {
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate export system health score
 * @param {Object} recovery - Recovery status data
 * @returns {number} Health score 0-100
 */
function calculateHealthScore(recovery) {
  let score = 100;
  
  // Deduct for stuck operations
  score -= (recovery.stagingIssues.stuck * 2);
  score -= (recovery.deliveryIssues.stuck * 2);
  
  // Deduct for failed operations
  score -= (recovery.stagingIssues.failed * 1);
  score -= (recovery.deliveryIssues.failed * 1);
  
  // Deduct for abandoned exports
  score -= (recovery.abandonedExports.count * 0.5);
  
  return Math.max(0, Math.min(100, score));
}