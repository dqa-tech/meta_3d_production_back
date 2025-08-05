/**
 * Import batch management
 * Handles batch creation and tracking
 */

/**
 * Simple reliable import - minimal complexity, maximum reliability
 * @param {string} importFolderId - Source folder ID
 * @param {string} productionFolderId - Target folder ID  
 * @param {string} batchName - Batch name
 * @param {string} batchGroup - Group assignment
 * @returns {Object} Import results
 */
function simpleReliableImport(importFolderId, productionFolderId, batchName, batchGroup) {
  const startTime = new Date();
  
  // Log to verify this function is being called
  info('SIMPLE RELIABLE IMPORT STARTED', {
    importFolder: importFolderId,
    batchGroup: batchGroup
  });
  
  try {
    // Generate simple batch ID
    const timestamp = new Date();
    const batchId = 'IMP_' + timestamp.getTime();
    const isoTime = timestamp.toISOString();
    
    // Get folders
    const importFolder = DriveApp.getFolderById(importFolderId);
    const productionFolder = DriveApp.getFolderById(productionFolderId);
    
    // Get all task folders
    const folders = importFolder.getFolders();
    const tasks = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      tasks.push({
        folder: folder,
        name: folder.getName()
      });
    }
    
    // Get sheet reference
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Tasks');
    if (!sheet) {
      throw new Error('Tasks sheet not found');
    }
    
    // Process each task and collect data
    const sheetData = [];
    let successCount = 0;
    
    for (let i = 0; i < tasks.length; i++) {
      try {
        const task = tasks[i];
        
        // Create production folder
        const newFolder = productionFolder.createFolder(task.name);
        
        // Copy files
        const files = task.folder.getFiles();
        const fileUrls = {};
        
        while (files.hasNext()) {
          const file = files.next();
          const fileName = file.getName();
          
          if (fileName === 'image.jpg' || fileName === 'img_mask.jpg' || fileName === 'mask.jpg') {
            const copy = file.makeCopy(fileName, newFolder);
            fileUrls[fileName] = copy.getUrl();
          }
        }
        
        // Only add to sheet if all 3 files exist
        if (fileUrls['image.jpg'] && fileUrls['img_mask.jpg'] && fileUrls['mask.jpg']) {
          // Build row matching COLUMN_ORDER (from schema.js)
          const row = [];
          row[0] = Utilities.getUuid();        // TASK_ID
          row[1] = batchId;                    // BATCH_ID
          row[2] = batchGroup;                 // GROUP
          row[3] = task.name;                  // FOLDER_NAME
          row[4] = isoTime;                    // IMPORT_TIME
          row[5] = newFolder.getUrl();         // PRODUCTION_FOLDER_LINK
          row[6] = 'open';                     // STATUS
          row[7] = '';                         // AGENT_EMAIL
          row[8] = '';                         // START_TIME
          row[9] = '';                         // END_TIME
          row[10] = fileUrls['image.jpg'];    // IMAGE_LINK
          row[11] = fileUrls['img_mask.jpg']; // IMG_MASK_LINK
          row[12] = fileUrls['mask.jpg'];     // MASK_LINK
          row[13] = '';                        // OBJ_LINK
          row[14] = '';                        // ALIGNMENT_LINK
          row[15] = '';                        // VIDEO_LINK
          row[16] = '';                        // EXPORT_TIME
          row[17] = '';                        // EXPORT_BATCH_ID
          
          sheetData.push(row);
          successCount++;
        }
        
      } catch (e) {
        // Log the error but continue
        error('Failed to process task', {
          taskName: task.name,
          error: e.toString()
        });
        continue;
      }
    }
    
    // Write all data to sheet at once
    if (sheetData.length > 0) {
      info('Writing to sheet', {
        rowCount: sheetData.length,
        columnCount: sheetData[0].length,
        firstTaskName: tasks[0]?.name
      });
      
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, sheetData.length, sheetData[0].length).setValues(sheetData);
      
      info('Sheet write completed', {
        rowsWritten: sheetData.length
      });
    } else {
      warn('No data to write to sheet', {
        taskCount: tasks.length,
        successCount: successCount
      });
    }
    
    // Return simple serializable object
    const duration = new Date().getTime() - startTime.getTime();
    
    return {
      batch: {
        id: batchId,
        duration: duration,
        group: batchGroup
      },
      import: {
        total: tasks.length,
        successful: successCount,
        failed: tasks.length - successCount
      },
      sheet: {
        created: successCount
      }
    };
    
  } catch (error) {
    // Return error in serializable format
    return {
      batch: {
        id: 'ERROR',
        duration: 0,
        group: batchGroup || 'A'
      },
      import: {
        total: 0,
        successful: 0,
        failed: 0
      },
      sheet: {
        created: 0
      },
      error: error.toString()
    };
  }
}

/**
 * Blazing fast import - minimal operations for maximum speed
 * @param {string} importFolderId - Source folder ID
 * @param {string} productionFolderId - Target folder ID  
 * @param {string} batchName - Batch name
 * @param {string} batchGroup - Group assignment
 * @returns {Object} Import results
 */
function blazingFastImport(importFolderId, productionFolderId, batchName, batchGroup) {
  const startTime = new Date();
  const batchId = generateBatchId(batchName || 'IMP');
  const timestamp = new Date().toISOString();
  
  // Get all folders at once
  const importFolder = DriveApp.getFolderById(importFolderId);
  const productionFolder = DriveApp.getFolderById(productionFolderId);
  const folders = importFolder.getFolders();
  
  // Collect all data first
  const tasksToProcess = [];
  while (folders.hasNext()) {
    const folder = folders.next();
    tasksToProcess.push({
      folder: folder,
      name: folder.getName(),
      id: folder.getId()
    });
  }
  
  // Process all at once
  const sheetRows = [];
  
  tasksToProcess.forEach(task => {
    // Create folder
    const newFolder = productionFolder.createFolder(task.name);
    const newFolderUrl = newFolder.getUrl();
    
    // Get file URLs
    const files = task.folder.getFiles();
    const fileMap = {};
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();
      if (['image.jpg', 'img_mask.jpg', 'mask.jpg'].includes(fileName)) {
        const copy = file.makeCopy(fileName, newFolder);
        fileMap[fileName] = copy.getUrl();
      }
    }
    
    // Only add if has all 3 files
    if (fileMap['image.jpg'] && fileMap['img_mask.jpg'] && fileMap['mask.jpg']) {
      // Build row array directly
      const row = new Array(COLUMN_ORDER.length).fill('');
      
      // Use column indices directly for speed
      row[getColumnIndex('TASK_ID') - 1] = generateUUID();
      row[getColumnIndex('BATCH_ID') - 1] = batchId;
      row[getColumnIndex('GROUP') - 1] = batchGroup;
      row[getColumnIndex('FOLDER_NAME') - 1] = task.name;
      row[getColumnIndex('STATUS') - 1] = STATUS_VALUES.OPEN;
      row[getColumnIndex('IMPORT_TIME') - 1] = timestamp;
      row[getColumnIndex('PRODUCTION_FOLDER_LINK') - 1] = newFolderUrl;
      row[getColumnIndex('IMAGE_LINK') - 1] = fileMap['image.jpg'];
      row[getColumnIndex('IMG_MASK_LINK') - 1] = fileMap['img_mask.jpg'];
      row[getColumnIndex('MASK_LINK') - 1] = fileMap['mask.jpg'];
      
      sheetRows.push(row);
    }
  });
  
  // Single sheet write
  if (sheetRows.length > 0) {
    const sheet = getTasksSheet();
    sheet.getRange(sheet.getLastRow() + 1, 1, sheetRows.length, COLUMN_ORDER.length).setValues(sheetRows);
  }
  
  return {
    batch: {
      id: batchId,
      duration: (new Date() - startTime),  // Ensure it's a number
      group: batchGroup
    },
    import: {
      total: tasksToProcess.length,
      successful: sheetRows.length,
      failed: 0
    },
    sheet: {
      created: sheetRows.length
    }
  };
}

/**
 * Create import batch
 * @param {Object} options - Batch options
 * @returns {Object} Batch information
 */
function createImportBatch(options = {}) {
  const batchId = generateBatchId(options.name || 'IMP');
  const timestamp = new Date().toISOString();
  
  const batch = {
    id: batchId,
    name: options.name || batchId,
    group: options.group || 'A',
    createdAt: timestamp,
    taskCount: 0,
    status: 'created'
  };
  
  info('Import batch created', batch);
  
  return batch;
}

/**
 * Generate batch ID
 * @param {string} prefix - Batch prefix
 * @returns {string} Batch ID
 */
function generateBatchId(prefix = 'IMP') {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-T:]/g, '')
    .replace(/\.\d{3}Z$/, '');
  
  // Add random suffix for uniqueness
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Execute import batch
 * @param {string} importFolderId - Import folder ID
 * @param {string} productionFolderId - Production folder ID
 * @param {Object} options - Import options
 * @returns {Object} Import results
 */
function executeImportBatch(importFolderId, productionFolderId, options = {}) {
  const startTime = new Date();
  
  try {
    // Create batch
    const batch = createImportBatch({
      name: options.batchName,
      group: options.group
    });
    
    // Scan import folder
    const scanResult = scanImportFolder(importFolderId);
    
    if (scanResult.valid.length === 0) {
      throw new Error('No valid task folders found to import');
    }
    
    // Check for duplicates
    const duplicateCheck = checkForDuplicates(scanResult.valid, productionFolderId);
    const tasksToImport = options.skipDuplicates 
      ? duplicateCheck.tasks.filter(t => !t.isDuplicate)
      : duplicateCheck.tasks;
    
    if (tasksToImport.length === 0) {
      throw new Error('All tasks already exist in production folder');
    }
    
    // Copy tasks
    const copyResults = copyTasksToProduction(
      tasksToImport, 
      productionFolderId, 
      batch.id,
      options.onProgress
    );
    
    // Create sheet records
    const sheetResults = createSheetRecords(copyResults, batch);
    
    // Update batch status
    batch.taskCount = sheetResults.created;
    batch.status = 'completed';
    batch.duration = new Date() - startTime;
    
    // Create summary
    const summary = createImportSummary(copyResults);
    
    return {
      batch: batch,
      import: summary,
      sheet: sheetResults,
      scan: scanResult.summary,
      duplicates: duplicateCheck
    };
    
  } catch (error) {
    error('Import batch failed', {
      importFolder: importFolderId,
      productionFolder: productionFolderId,
      options: options,
      error: error.message
    });
    throw error;
  }
}

/**
 * Create sheet records from copy results
 * @param {Array} copyResults - Copy operation results
 * @param {Object} batch - Batch information
 * @returns {Object} Sheet operation results
 */
function createSheetRecords(copyResults, batch) {
  const sheet = getTasksSheet();
  const timestamp = new Date().toISOString();
  
  let created = 0;
  let failed = 0;
  
  copyResults.forEach(result => {
    if (result.success) {
      try {
        const taskData = {
          taskId: result.taskId,
          batchId: batch.id,
          group: batch.group,
          folderName: result.originalFolder.name,
          status: STATUS_VALUES.OPEN,
          importTime: timestamp,
          productionFolderLink: result.productionFolder.url
        };
        
        // Add file links
        if (result.files && result.files.length > 0) {
          result.files.forEach(file => {
            if (file.copy.name === 'image.jpg') {
              taskData.imageLink = file.copy.url;
            } else if (file.copy.name === 'img_mask.jpg') {
              taskData.imgMaskLink = file.copy.url;
            } else if (file.copy.name === 'mask.jpg') {
              taskData.maskLink = file.copy.url;
            }
          });
        }
        
        createTaskRecord(taskData);
        created++;
      } catch (err) {
        failed++;
        error('Failed to create sheet record', {
          taskId: result.taskId,
          error: err.message
        });
      }
    } else {
      failed++;
    }
  });
  
  return {
    created: created,
    failed: failed
  };
}