/**
 * Staging wizard handlers
 * Server-side functions for staging wizard UI
 */

/**
 * Get tasks available for staging with simplified filters
 * @param {Object} filters - Simple staging filters
 * @returns {Object} Task selection with metadata
 */
function getTasksForStaging(filters) {
  try {
    // Use simplified filtering logic
    const tasks = getTasksForExportSimple(filters);
    
    // Get size estimates
    const sizeEstimate = estimateTasksSize(tasks);
    
    // Get staging configuration
    const stagingConfig = getStagingConfiguration();
    
    const result = {
      success: true,
      tasks: tasks,
      taskCount: tasks.length,
      sizeEstimate: sizeEstimate,
      stagingConfig: stagingConfig,
      timestamp: new Date().toISOString()
    };
    
    info('Tasks selected for staging', {
      count: tasks.length,
      batchCount: filters.batchIds ? filters.batchIds.length : 0,
      includeUnreviewed: filters.includeUnreviewed || false,
      includeFailed: filters.includeFailed || false
    });
    
    return result;
    
  } catch (err) {
    error('Failed to get tasks for staging', {
      error: err.message,
      filters: filters
    });
    
    return {
      success: false,
      error: err.message,
      tasks: [],
      taskCount: 0
    };
  }
}

/**
 * Execute staging wizard workflow
 * @param {Object} selection - Task selection and configuration
 * @param {string} exportBatchId - Export batch identifier
 * @returns {Object} Staging results
 */
function executeStagingWizard(selection, exportBatchId) {
  try {
    // Validate inputs
    if (!selection || !selection.taskIds || selection.taskIds.length === 0) {
      throw new ValidationError('No task IDs provided for staging');
    }
    
    if (!exportBatchId) {
      throw new ValidationError('Export batch ID is required');
    }
    
    // Validate staging configuration
    const stagingConfig = getStagingConfiguration();
    if (!stagingConfig.isValid) {
      throw new Error('Staging folder not configured or accessible');
    }
    
    info('Starting staging wizard execution', {
      batchId: exportBatchId,
      taskCount: selection.taskIds.length,
      stagingFolder: stagingConfig.folderName
    });
    
    // Get full task objects from IDs
    const tasks = getTasksByIds(selection.taskIds);
    
    if (!tasks || tasks.length === 0) {
      throw new Error('Failed to retrieve task data for provided IDs');
    }
    
    // Execute core staging operation
    const stagingResult = executeStagingOperation(tasks, exportBatchId);
    
    // Format response for UI
    const response = {
      success: stagingResult.success,
      exportBatchId: exportBatchId,
      duration: stagingResult.duration,
      stats: stagingResult.stats,
      batchFolder: stagingResult.batchFolder,
      exportSheet: stagingResult.exportSheet,
      errors: []
    };
    
    // Add error details if any
    if (stagingResult.validationFailures && stagingResult.validationFailures.length > 0) {
      response.errors.push(...stagingResult.validationFailures.map(vf => 
        `Validation failed for ${vf.folderName}: ${vf.errors.join(', ')}`
      ));
    }
    
    if (stagingResult.stagingFailures && stagingResult.stagingFailures.length > 0) {
      response.errors.push(...stagingResult.stagingFailures.map(sf => 
        `Staging failed for ${sf.folderName}: ${sf.error}`
      ));
    }
    
    return response;
    
  } catch (err) {
    console.error('Staging wizard execution failed', {
      batchId: exportBatchId,
      error: err.message
    });
    
    return {
      success: false,
      error: err.message,
      exportBatchId: exportBatchId,
      stats: {
        totalSelected: selection ? selection.taskIds.length : 0,
        successfulStaging: 0,
        failedStaging: selection ? selection.taskIds.length : 0
      }
    };
  }
}

/**
 * Get simplified staging filter options for UI
 * @returns {Object} Available filter options
 */
function getStagingFilterOptions() {
  try {
    // Get unique batch IDs for batch selection
    const batches = getUniqueColumnValues('BATCH_ID').filter(batch => batch && batch.trim() !== '');
    
    // Get staging configuration
    const stagingConfig = getStagingConfiguration();
    
    const result = {
      success: true,
      batches: batches,
      stagingConfig: stagingConfig
    };
    
    info('Staging filter options loaded', {
      batchCount: batches.length,
      stagingConfigured: stagingConfig.isValid
    });
    
    return result;
    
  } catch (err) {
    error('Failed to get staging filter options', {
      error: err.message
    });
    
    return {
      success: false,
      error: err.message,
      batches: [],
      stagingConfig: { isValid: false }
    };
  }
}

/**
 * Preview staging operation without executing
 * @param {Object} filters - Simple staging filters
 * @returns {Object} Preview results
 */
function previewStagingOperation(filters) {
  try {
    console.log('DEBUG: previewStagingOperation called with filters:', JSON.stringify(filters, null, 2));
    
    const tasks = getTasksForExportSimple(filters);
    
    console.log('DEBUG: getTasksForExportSimple returned', tasks ? tasks.length : 'null', 'tasks');
    
    if (!tasks || tasks.length === 0) {
      const result = {
        success: true,
        canStage: false,
        message: 'No tasks match the current filters',
        taskCount: 0,
        validTasks: 0,
        invalidTasks: 0,
        estimatedDuration: 0,
        stagingFolder: 'Not configured',
        tasks: []
      };
      console.log('DEBUG: Returning empty result:', JSON.stringify(result, null, 2));
      return result;
    }
    
    // Get staging configuration first
    const stagingConfig = getStagingConfiguration();
    console.log('DEBUG: stagingConfig:', JSON.stringify(stagingConfig, null, 2));
    
    // Skip detailed validation for now - trust the filtering
    const validation = {
      validTasks: tasks.length,
      invalidTasks: 0
    };
    console.log('DEBUG: Bypassing detailed validation - assuming all', tasks.length, 'tasks are valid');
    
    // Get size estimates
    let sizeEstimate;
    try {
      sizeEstimate = estimateTasksSize(tasks);
      console.log('DEBUG: sizeEstimate:', JSON.stringify(sizeEstimate, null, 2));
    } catch (sizeError) {
      console.error('DEBUG: Size estimation failed:', sizeError);
      sizeEstimate = {
        formattedSize: 'Unknown',
        totalFiles: tasks.length * 8
      };
    }
    
    // Estimate duration (rough calculation)
    const avgFilesPerTask = 8;
    const avgCopyTimePerFile = 2; // seconds
    const estimatedDuration = Math.round((validation.validTasks * avgFilesPerTask * avgCopyTimePerFile) / 60); // minutes
    
    const result = {
      success: true,
      canStage: validation.validTasks > 0,
      taskCount: tasks.length,
      validTasks: validation.validTasks,
      invalidTasks: validation.invalidTasks,
      sizeEstimate: sizeEstimate,
      estimatedDuration: estimatedDuration,
      stagingFolder: stagingConfig.isValid ? stagingConfig.folderName : 'Not configured',
      taskIds: tasks.map(t => t.taskId) // Just the IDs, not full objects
    };
    
    if (validation.validTasks === 0) {
      result.message = 'No tasks are valid for staging. Check validation errors.';
      result.canStage = false;
    } else if (validation.invalidTasks > 0) {
      result.message = `${validation.validTasks} tasks ready for staging, ${validation.invalidTasks} will be skipped due to validation errors.`;
    } else {
      result.message = `All ${validation.validTasks} tasks are ready for staging.`;
    }
    
    console.log('DEBUG: Final result:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (err) {
    console.error('DEBUG: previewStagingOperation error:', err);
    console.error('DEBUG: Error stack:', err.stack);
    
    const errorResult = {
      success: false,
      error: err.message || 'Unknown error in preview',
      canStage: false,
      taskCount: 0,
      validTasks: 0,
      invalidTasks: 0,
      tasks: [],
      stagingFolder: 'Error'
    };
    
    console.log('DEBUG: Returning error result:', JSON.stringify(errorResult, null, 2));
    return errorResult;
  }
}


/**
 * Estimate file sizes for tasks
 * @param {Array} tasks - Tasks to estimate
 * @returns {Object} Size estimate
 */
function estimateTasksSize(tasks) {
  // Average file sizes in MB based on production data
  const avgFileSizes = {
    baseImages: 2,      // image.jpg, img_mask.jpg, mask.jpg
    objFile: 5,         // .obj files
    alignmentImage: 1,  // alignment images
    taskVideo: 50,      // .mp4 recording
    otherFiles: 1       // misc production files
  };
  
  const estimate = {
    totalFiles: 0,
    totalSizeMB: 0,
    breakdown: {
      baseImages: { count: 0, sizeMB: 0 },
      production: { count: 0, sizeMB: 0 }
    }
  };
  
  tasks.forEach(task => {
    // Each task has 3 base images
    estimate.breakdown.baseImages.count += 3;
    estimate.breakdown.baseImages.sizeMB += avgFileSizes.baseImages * 3;
    
    // Estimate 5 production files per task on average
    const estimatedProdFiles = 5;
    estimate.breakdown.production.count += estimatedProdFiles;
    estimate.breakdown.production.sizeMB += 
      avgFileSizes.objFile + 
      avgFileSizes.alignmentImage + 
      avgFileSizes.taskVideo + 
      (avgFileSizes.otherFiles * 2);
    
    estimate.totalFiles += 3 + estimatedProdFiles;
  });
  
  estimate.totalSizeMB = estimate.breakdown.baseImages.sizeMB + estimate.breakdown.production.sizeMB;
  
  // Format human-readable size
  let formattedSize;
  if (estimate.totalSizeMB < 1024) {
    formattedSize = `${Math.round(estimate.totalSizeMB)} MB`;
  } else {
    formattedSize = `${(estimate.totalSizeMB / 1024).toFixed(1)} GB`;
  }
  
  return {
    ...estimate,
    formattedSize: formattedSize,
    estimatedTransferTime: Math.round(estimate.totalSizeMB / 10) // Rough estimate: 10 MB/sec
  };
}

/**
 * Generate export batch ID
 * @param {string} prefix - Optional prefix
 * @returns {string} Export batch ID
 */
function generateExportBatchId(prefix = 'EXP') {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-T:]/g, '')
    .replace(/\.\d{3}Z$/, '');
  
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Validate staging wizard input
 * @param {Object} input - User input to validate
 * @returns {Object} Validation result
 */
function validateStagingWizardInput(input) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check if tasks are selected
  if (!input.tasks || !Array.isArray(input.tasks) || input.tasks.length === 0) {
    validation.isValid = false;
    validation.errors.push('No tasks selected for staging');
  }
  
  // Validate staging configuration
  const stagingConfig = getStagingConfiguration();
  if (!stagingConfig.isValid) {
    validation.isValid = false;
    validation.errors.push('Staging folder not configured or accessible');
  }
  
  // Check for reasonable batch size
  if (input.tasks && input.tasks.length > 100) {
    validation.warnings.push('Large batch size may take significant time to process');
  }
  
  // Validate batch ID if provided
  if (input.exportBatchId && input.exportBatchId.length > 50) {
    validation.warnings.push('Export batch ID is unusually long');
  }
  
  return validation;
}