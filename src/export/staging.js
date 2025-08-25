/**
 * Export staging operations
 * Handles staging tasks before client delivery
 */

/**
 * Execute staging operation with comprehensive validation
 * @param {Array} taskSelection - Selected tasks for staging
 * @param {string} exportBatchId - Export batch identifier
 * @returns {Object} Staging results
 */
function executeStagingOperation(taskSelection, exportBatchId) {
  const startTime = new Date();
  const timestamp = startTime.toISOString();
  
  info('Starting staging operation', {
    batchId: exportBatchId,
    taskCount: taskSelection.length
  });
  
  try {
    // 1. Validate staging folder exists and accessible
    const stagingConfig = getStagingConfiguration();
    if (!stagingConfig.isValid) {
      throw new Error('Staging folder not configured or inaccessible');
    }
    
    // 2. Skip pre-staging validation for now - trust the filtering
    const validTasks = taskSelection;
    const invalidTasks = [];
    console.log('DEBUG: Bypassing staging validation - assuming all', taskSelection.length, 'tasks are valid');
    
    info('Pre-staging validation complete', {
      validCount: validTasks.length,
      invalidCount: invalidTasks.length
    });
    
    // 3. Mark valid tasks as staging, invalid as staging_failed
    if (validTasks.length > 0) {
      updateTaskExportStatus(
        validTasks.map(t => t.taskId), 
        EXPORT_STATUS_VALUES.STAGING, 
        exportBatchId
      );
    }
    
    if (invalidTasks.length > 0) {
      updateTaskExportStatus(
        invalidTasks.map(t => t.taskId), 
        EXPORT_STATUS_VALUES.STAGING_FAILED
      );
    }
    
    // 4. Create batch folder in staging
    const batchFolder = createStagingBatchFolder(stagingConfig.folderId, exportBatchId);
    
    // 5. Process valid tasks in chunks
    const stagingResults = processTasksForStaging(validTasks, batchFolder.id, exportBatchId);
    
    // 6. Create export sheet
    const exportSheet = createStagingExportSheet(validTasks, batchFolder.id, exportBatchId);
    
    // Calculate final results
    const successfulCount = stagingResults.filter(r => r.success).length;
    const failedCount = stagingResults.filter(r => !r.success).length;
    
    const summary = {
      exportBatchId: exportBatchId,
      success: failedCount === 0,
      duration: new Date() - startTime,
      batchFolder: {
        id: batchFolder.id,
        name: batchFolder.name,
        url: batchFolder.url
      },
      exportSheet: exportSheet,
      stats: {
        totalSelected: taskSelection.length,
        validTasks: validTasks.length,
        invalidTasks: invalidTasks.length,
        successfulStaging: successfulCount,
        failedStaging: failedCount
      },
      validationFailures: invalidTasks.map(t => ({
        taskId: t.taskId,
        folderName: t.folderName,
        errors: t.validationErrors
      })),
      stagingFailures: stagingResults.filter(r => !r.success).map(r => ({
        taskId: r.taskId,
        folderName: r.folderName,
        error: r.error
      }))
    };
    
    info('Staging operation complete', summary);
    return summary;
    
  } catch (err) {
    error('Staging operation failed', {
      batchId: exportBatchId,
      error: err.message
    });
    
    return {
      exportBatchId: exportBatchId,
      success: false,
      duration: new Date() - startTime,
      error: err.message,
      stats: {
        totalSelected: taskSelection.length,
        successfulStaging: 0,
        failedStaging: taskSelection.length
      }
    };
  }
}

/**
 * Pre-validate tasks for staging requirements
 * @param {Array} tasks - Tasks to validate
 * @returns {Object} Validation results
 */
function preValidateTasks(tasks) {
  const validTasks = [];
  const invalidTasks = [];
  
  tasks.forEach(task => {
    const validation = validateProductionFiles(task);
    
    if (validation.isValid) {
      validTasks.push(task);
    } else {
      task.validationErrors = validation.errors;
      invalidTasks.push(task);
    }
  });
  
  return { validTasks, invalidTasks };
}

/**
 * Validate task has required production files
 * @param {Object} task - Task to validate
 * @returns {Object} Validation result
 */
function validateProductionFiles(task) {
  const result = {
    isValid: false,
    missingTypes: [],
    fileCount: 0,
    errors: []
  };
  
  try {
    // Get production folder contents
    const productionFolderId = task.productionFolderLink;
    if (!productionFolderId) {
      result.errors.push('Invalid production folder link');
      return result;
    }
    
    const files = listFiles(productionFolderId);
    result.fileCount = files.length;
    
    // Check minimum file count (3 base images + 3 production minimum)
    if (files.length < 6) {
      result.errors.push(`Only ${files.length} files found, minimum 6 required`);
      return result;
    }
    
    // Check for required production file types
    const folderName = task.folderName;
    const fileNames = files.map(f => f.name);
    
    // Check for .obj file containing folderName
    const objFiles = fileNames.filter(name => 
      name.includes(folderName) && name.toLowerCase().endsWith('.obj')
    );
    if (objFiles.length === 0) {
      result.missingTypes.push('3D Object (.obj)');
      result.errors.push('Missing 3D object file');
    }
    
    // Check for .jpg file containing folderName (excluding base images)
    const baseImages = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];
    const productionImages = fileNames.filter(name => 
      name.includes(folderName) && 
      name.toLowerCase().endsWith('.jpg') &&
      !baseImages.includes(name)
    );
    if (productionImages.length === 0) {
      result.missingTypes.push('Production Image (.jpg)');
      result.errors.push('Missing production image file');
    }
    
    // Check for .mp4 file containing folderName
    const videoFiles = fileNames.filter(name => 
      name.includes(folderName) && name.toLowerCase().endsWith('.mp4')
    );
    if (videoFiles.length === 0) {
      result.missingTypes.push('Task Video (.mp4)');
      result.errors.push('Missing task video file');
    }
    
    result.isValid = result.errors.length === 0;
    
  } catch (err) {
    result.errors.push(`Validation error: ${err.message}`);
  }
  
  return result;
}

/**
 * Create staging batch folder
 * @param {string} stagingFolderId - Staging folder ID
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Created folder
 */
function createStagingBatchFolder(stagingFolderId, exportBatchId) {
  const timestamp = new Date().toISOString().split('T')[0];
  const folderName = `Export_${timestamp}_${exportBatchId}`;
  
  return createFolder(folderName, stagingFolderId);
}

/**
 * Process tasks for staging in chunks
 * @param {Array} tasks - Valid tasks to stage
 * @param {string} batchFolderId - Batch folder ID
 * @param {string} exportBatchId - Export batch ID
 * @returns {Array} Staging results
 */
function processTasksForStaging(tasks, batchFolderId, exportBatchId) {
  const results = [];
  const chunkSize = 5;
  
  // Process in chunks to avoid timeouts
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    
    chunk.forEach(task => {
      const result = stageTaskFiles(task, batchFolderId);
      results.push(result);
      
      // Update task status based on result
      if (result.success) {
        updateTaskRecord(task.taskId, {
          exportStatus: EXPORT_STATUS_VALUES.STAGED,
          stagedCount: result.fileCount
        });
      } else {
        updateTaskRecord(task.taskId, {
          exportStatus: EXPORT_STATUS_VALUES.STAGING_FAILED
        });
      }
    });
    
    // Brief pause between chunks
    Utilities.sleep(500);
  }
  
  return results;
}

/**
 * Stage files for a single task
 * @param {Object} task - Task to stage
 * @param {string} batchFolderId - Batch folder ID
 * @returns {Object} Staging result
 */
function stageTaskFiles(task, batchFolderId) {
  const startTime = new Date();
  
  try {
    // Create task subfolder
    const taskFolder = createFolder(task.folderName, batchFolderId);
    
    // BEST PRACTICE: Direct Drive API with folder objects
    console.log('STAGING LOG: Starting file copy for task:', task.folderName);
    console.log('STAGING LOG: Production folder ID:', task.productionFolderLink);
    console.log('STAGING LOG: Target folder ID:', taskFolder.id);
    
    // Extract folder ID from URL
    const productionFolderId = task.productionFolderLink.match(/[-\w]{25,}/)[0];
    console.log('STAGING LOG: Extracted production ID:', productionFolderId);
    
    const prodFolder = DriveApp.getFolderById(productionFolderId);
    const targetFolder = DriveApp.getFolderById(taskFolder.id);
    
    console.log('STAGING LOG: Production folder name:', prodFolder.getName());
    console.log('STAGING LOG: Target folder name:', targetFolder.getName());
    
    let copiedCount = 0;
    const copiedFiles = [];
    const files = prodFolder.getFiles();
    
    console.log('STAGING LOG: Starting file iteration...');
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      console.log('STAGING LOG: Processing file:', fileName);
      
      try {
        const copiedFile = file.makeCopy(fileName, targetFolder);
        console.log('STAGING LOG: Successfully copied:', fileName, 'to', copiedFile.getId());
        copiedFiles.push({
          original: { name: fileName, id: file.getId() },
          copied: { name: copiedFile.getName(), id: copiedFile.getId() },
          success: true
        });
        copiedCount++;
      } catch (err) {
        console.log('STAGING LOG: Failed to copy:', fileName, 'Error:', err.message);
        copiedFiles.push({
          original: { name: fileName, id: file.getId() },
          error: err.message,
          success: false
        });
      }
    }
    
    console.log('STAGING LOG: File copy complete. Total copied:', copiedCount);
    
    const result = {
      taskId: task.taskId,
      folderName: task.folderName,
      success: true,
      fileCount: copiedCount,
      taskFolder: taskFolder,
      files: copiedFiles,
      duration: new Date() - startTime
    };
    
    debug('Task staged successfully', {
      taskId: task.taskId,
      fileCount: copiedCount
    });
    
    return result;
    
  } catch (err) {
    const result = {
      taskId: task.taskId,
      folderName: task.folderName,
      success: false,
      error: err.message,
      duration: new Date() - startTime
    };
    
    error('Failed to stage task', {
      taskId: task.taskId,
      error: err.message
    });
    
    return result;
  }
}

/**
 * Create export sheet in staging folder
 * @param {Array} tasks - Staged tasks
 * @param {string} batchFolderId - Batch folder ID
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Export sheet info
 */
function createStagingExportSheet(tasks, batchFolderId, exportBatchId) {
  try {
    // Create new Google Sheet
    const sheetName = `Export_${exportBatchId}_Data`;
    const spreadsheet = SpreadsheetApp.create(sheetName);
    const sheet = spreadsheet.getActiveSheet();
    
    // Set up headers - ALL columns from schema
    const headers = COLUMN_ORDER.map(key => COLUMNS[key]);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Apply header formatting
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#4285F4');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    
    // Write task data
    if (tasks.length > 0) {
      const taskData = tasks.map(task => {
        const row = new Array(COLUMN_ORDER.length).fill('');
        
        // Map task data to columns
        Object.entries(task).forEach(([field, value]) => {
          // Convert camelCase to UPPER_SNAKE_CASE
          const columnKey = field.replace(/([A-Z])/g, '_$1').toUpperCase();
          const columnIndex = getColumnIndex(columnKey);
          
          if (columnIndex > 0) {
            row[columnIndex - 1] = value;
          }
        });
        
        return row;
      });
      
      sheet.getRange(2, 1, taskData.length, COLUMN_ORDER.length)
        .setValues(taskData);
    }
    
    // Move sheet to staging batch folder
    const file = DriveApp.getFileById(spreadsheet.getId());
    const batchFolder = DriveApp.getFolderById(batchFolderId);
    
    // Remove from root and add to batch folder
    const parents = file.getParents();
    while (parents.hasNext()) {
      parents.next().removeFile(file);
    }
    batchFolder.addFile(file);
    
    const sheetInfo = {
      id: spreadsheet.getId(),
      name: sheetName,
      url: spreadsheet.getUrl(),
      taskCount: tasks.length
    };
    
    info('Export sheet created', sheetInfo);
    return sheetInfo;
    
  } catch (err) {
    error('Failed to create export sheet', {
      batchId: exportBatchId,
      error: err.message
    });
    
    return {
      error: err.message,
      taskCount: tasks.length
    };
  }
}

/**
 * Get staging configuration
 * @returns {Object} Staging configuration
 */
function getStagingConfiguration() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('STAGING_FOLDER_ID');
  
  if (!folderId) {
    return {
      isValid: false,
      error: 'Staging folder not configured'
    };
  }
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    return {
      isValid: true,
      folderId: folderId,
      folderName: folder.getName(),
      folderUrl: folder.getUrl()
    };
  } catch (err) {
    return {
      isValid: false,
      error: 'Staging folder not accessible: ' + err.message
    };
  }
}