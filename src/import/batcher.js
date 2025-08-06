/**
 * Import batch management - Optimized for speed
 * Uses Drive API v3 batch operations for maximum performance
 */

/**
 * High-performance batch import using Drive API v3
 * @param {string} importFolderId - Source folder ID
 * @param {string} productionFolderId - Target folder ID  
 * @param {string} batchName - Batch name
 * @param {string} batchGroup - Group assignment (A, B, C, D)
 * @returns {Object} Import results
 */
function performBatchImport(importFolderId, productionFolderId, batchName, batchGroup) {
  const startTime = new Date();
  const batchId = generateBatchId(batchName || 'IMP');
  const timestamp = new Date().toISOString();
  
  console.log('performBatchImport called with:', {
    importFolderId: importFolderId,
    productionFolderId: productionFolderId,
    batchName: batchName,
    batchGroup: batchGroup
  });
  
  info('Starting optimized batch import', {
    importFolder: importFolderId,
    productionFolder: productionFolderId,
    batchGroup: batchGroup
  });
  
  try {
    // Initialize cache for this import
    const cache = createDriveCache();
    
    // Phase 1: Bulk load all metadata in one API call
    const allItems = cache.bulkLoadFolder(importFolderId);
    const folders = allItems.filter(item => 
      item.mimeType === 'application/vnd.google-apps.folder'
    );
    
    info('Folders discovered', { count: folders.length });
    
    // Phase 2: Quick validation using cached data
    const validTasks = [];
    const requiredFiles = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];
    
    folders.forEach(folder => {
      // Load folder contents into cache
      const folderFiles = bulkListFiles(folder.id);
      folderFiles.forEach(file => cache.addFile(file));
      
      // Check if has required files
      const fileNames = new Set(folderFiles.map(f => f.name));
      const hasAllFiles = requiredFiles.every(name => fileNames.has(name));
      
      if (hasAllFiles) {
        validTasks.push({
          folder: folder,
          files: folderFiles.filter(f => requiredFiles.includes(f.name))
        });
      }
    });
    
    info('Valid tasks identified', { count: validTasks.length });
    
    if (validTasks.length === 0) {
      return {
        batch: { id: batchId, duration: 0, group: batchGroup },
        import: { total: 0, successful: 0, failed: 0 },
        sheet: { created: 0 },
        error: 'No valid task folders found'
      };
    }
    
    // Phase 3: Batch create all folders in production
    const folderNames = validTasks.map(task => task.folder.name);
    console.log('Creating folders with batchCreateFolders:', folderNames);
    const createdFolders = batchCreateFolders(productionFolderId, folderNames);
    console.log('Created folders response:', createdFolders);
    
    info('Production folders created', { 
      count: createdFolders.length,
      firstFolder: createdFolders[0],
      hasErrors: createdFolders.some(f => f && f.error)
    });
    
    // Phase 4: Batch copy all files
    const copyMappings = [];
    validTasks.forEach((task, index) => {
      const targetFolder = createdFolders[index];
      if (targetFolder && !targetFolder.error) {
        task.files.forEach(file => {
          copyMappings.push({
            fileId: file.id,
            targetFolderId: targetFolder.id,
            newName: file.name
          });
        });
      }
    });
    
    const copiedFiles = batchCopyFiles(copyMappings);
    info('Files copied', { count: copiedFiles.length });
    
    // Phase 5: Build sheet data
    const sheetRows = [];
    let fileIndex = 0;
    
    validTasks.forEach((task, taskIndex) => {
      const targetFolder = createdFolders[taskIndex];
      
      // Debug logging
      if (taskIndex === 0) {
        console.log('First folder response:', targetFolder);
        info('First folder response structure', {
          targetFolder: targetFolder,
          hasError: targetFolder ? targetFolder.error : 'folder is null'
        });
      }
      
      if (targetFolder && !targetFolder.error) {
        const row = new Array(COLUMN_ORDER.length).fill('');
        
        // Core fields
        row[getColumnIndex('TASK_ID') - 1] = generateUUID();
        row[getColumnIndex('BATCH_ID') - 1] = batchId;
        row[getColumnIndex('GROUP') - 1] = batchGroup;
        row[getColumnIndex('FOLDER_NAME') - 1] = task.folder.name;
        row[getColumnIndex('STATUS') - 1] = STATUS_VALUES.OPEN;
        row[getColumnIndex('IMPORT_TIME') - 1] = timestamp;
        row[getColumnIndex('PRODUCTION_FOLDER_LINK') - 1] = 
          `https://drive.google.com/drive/folders/${targetFolder.id}`;
        
        // File links
        task.files.forEach(() => {
          const copiedFile = copiedFiles[fileIndex++];
          if (copiedFile && !copiedFile.error) {
            const fileName = copiedFile.name;
            const fileUrl = copiedFile.webViewLink || 
              `https://drive.google.com/file/d/${copiedFile.id}/view`;
            
            if (fileName === 'image.jpg') {
              row[getColumnIndex('IMAGE_LINK') - 1] = fileUrl;
            } else if (fileName === 'img_mask.jpg') {
              row[getColumnIndex('IMG_MASK_LINK') - 1] = fileUrl;
            } else if (fileName === 'mask.jpg') {
              row[getColumnIndex('MASK_LINK') - 1] = fileUrl;
            }
          }
        });
        
        sheetRows.push(row);
      } else {
        warn('Skipping task due to folder creation issue', {
          taskIndex: taskIndex,
          folderName: task.folder.name,
          targetFolder: targetFolder
        });
      }
    });
    
    // Phase 6: Single batch write to sheet
    console.log('Sheet rows to write:', sheetRows.length, 'from', validTasks.length, 'valid tasks');
    info('Sheet rows prepared', {
      rowCount: sheetRows.length,
      validTaskCount: validTasks.length,
      foldersCreated: createdFolders.filter(f => f && !f.error).length
    });
    
    if (sheetRows.length > 0) {
      const sheet = getTasksSheet();
      const lastRow = sheet.getLastRow();
      sheet.getRange(lastRow + 1, 1, sheetRows.length, COLUMN_ORDER.length)
        .setValues(sheetRows);
      
      info('Sheet records created', { count: sheetRows.length });
    }
    
    // Calculate duration
    const duration = new Date() - startTime;
    
    return {
      batch: {
        id: batchId,
        duration: duration,
        group: batchGroup
      },
      import: {
        total: validTasks.length,
        successful: sheetRows.length,
        failed: validTasks.length - sheetRows.length,
        failedTasks: [] // No failed tasks to report in success case
      },
      sheet: {
        created: sheetRows.length
      }
    };
    
  } catch (err) {
    warn('Batch import failed', {
      error: err.toString(),
      importFolder: importFolderId,
      productionFolder: productionFolderId
    });
    
    return {
      batch: {
        id: batchId,
        duration: new Date() - startTime,
        group: batchGroup
      },
      import: {
        total: 0,
        successful: 0,
        failed: 0
      },
      sheet: {
        created: 0
      },
      error: err.toString()
    };
  }
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
  
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}_${timestamp}_${random}`;
}