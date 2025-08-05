/**
 * Import folder scanner
 * Scans folders to find valid task folders
 */

const REQUIRED_FILES = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];

/**
 * Scan import folder for task folders
 * @param {string} importFolderId - Import folder ID
 * @returns {Array} Array of valid task folders
 */
function scanImportFolder(importFolderId) {
  info('Starting import folder scan', { folderId: importFolderId });
  
  try {
    const importFolder = DriveApp.getFolderById(importFolderId);
    const folders = importFolder.getFolders();
    const validTasks = [];
    const invalidTasks = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const folderInfo = validateTaskFolder(folder);
      
      if (folderInfo.isValid) {
        validTasks.push(folderInfo);
      } else {
        invalidTasks.push(folderInfo);
      }
    }
    
    info('Import scan complete', {
      valid: validTasks.length,
      invalid: invalidTasks.length
    });
    
    return {
      valid: validTasks,
      invalid: invalidTasks,
      summary: {
        totalFolders: validTasks.length + invalidTasks.length,
        validCount: validTasks.length,
        invalidCount: invalidTasks.length
      }
    };
  } catch (error) {
    throw new DriveError(`Failed to scan import folder: ${error.message}`, 'scanImportFolder', importFolderId);
  }
}

/**
 * Validate a task folder
 * @param {Folder} folder - Drive folder object
 * @returns {Object} Validation result
 */
function validateTaskFolder(folder) {
  const folderName = folder.getName();
  const folderId = folder.getId();
  
  const result = {
    id: folderId,
    name: folderName,
    url: folder.getUrl(),
    isValid: false,
    errors: [],
    files: {}
  };
  
  // No folder name validation needed - just check files
  
  // Check for required files
  const files = folder.getFiles();
  const foundFiles = {};
  
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    if (REQUIRED_FILES.includes(fileName)) {
      foundFiles[fileName] = {
        id: file.getId(),
        name: fileName,
        size: file.getSize(),
        mimeType: file.getMimeType()
      };
    }
  }
  
  // Verify all required files are present
  for (const requiredFile of REQUIRED_FILES) {
    if (!foundFiles[requiredFile]) {
      result.errors.push(`Missing required file: ${requiredFile}`);
    }
  }
  
  // Verify file types
  Object.entries(foundFiles).forEach(([fileName, fileInfo]) => {
    if (!fileInfo.mimeType.startsWith('image/')) {
      result.errors.push(`${fileName} is not an image file`);
    }
  });
  
  result.files = foundFiles;
  result.isValid = result.errors.length === 0;
  
  return result;
}

/**
 * Get task metadata from folder name
 * @param {string} folderName - Task folder name
 * @returns {Object} Task metadata
 */
function parseTaskFolderName(folderName) {
  // Example: mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0
  const parts = folderName.split('_');
  
  if (parts.length < 6) {
    return null;
  }
  
  return {
    prefix: parts[0],
    index1: parts[1],
    index2: parts[2],
    hash: parts[3],
    objectType: parts[4],
    index3: parts[5]
  };
}

/**
 * Scan for duplicate tasks
 * @param {Array} taskFolders - Array of task folders
 * @param {string} productionFolderId - Production folder ID
 * @returns {Object} Duplicate check results
 */
function checkForDuplicates(taskFolders, productionFolderId) {
  try {
    const productionFolder = DriveApp.getFolderById(productionFolderId);
    const existingFolders = new Set();
    
    // Get all existing folder names in production
    const folders = productionFolder.getFolders();
    while (folders.hasNext()) {
      existingFolders.add(folders.next().getName());
    }
    
    // Check each task folder
    const results = taskFolders.map(task => ({
      ...task,
      isDuplicate: existingFolders.has(task.name)
    }));
    
    const duplicates = results.filter(task => task.isDuplicate);
    
    return {
      tasks: results,
      duplicateCount: duplicates.length,
      duplicates: duplicates.map(d => d.name)
    };
  } catch (error) {
    throw new DriveError(`Failed to check duplicates: ${error.message}`, 'checkForDuplicates');
  }
}

/**
 * Preview import operation
 * @param {string} importFolderId - Import folder ID
 * @param {string} productionFolderId - Production folder ID
 * @returns {Object} Import preview
 */
function previewImport(importFolderId, productionFolderId) {
  // Blazing fast preview - combines scan and duplicate check
  const startTime = new Date();
  
  try {
    // Get all folders in import
    const importFolder = DriveApp.getFolderById(importFolderId);
    const productionFolder = DriveApp.getFolderById(productionFolderId);
    
    // Collect folder names
    const importFolders = [];
    const folders = importFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      importFolders.push({
        id: folder.getId(),
        name: folder.getName(),
        url: folder.getUrl()
      });
    }
    
    // Get existing production folder names
    const existingNames = new Set();
    const prodFolders = productionFolder.getFolders();
    while (prodFolders.hasNext()) {
      existingNames.add(prodFolders.next().getName());
    }
    
    // Quick filter
    const newTasks = [];
    const duplicates = [];
    
    importFolders.forEach(folder => {
      if (existingNames.has(folder.name)) {
        duplicates.push(folder);
      } else {
        newTasks.push({
          ...folder,
          isValid: true,
          isDuplicate: false,
          errors: []
        });
      }
    });
    
    return {
      canImport: newTasks.length > 0,
      message: `Found ${newTasks.length} new tasks to import`,
      totalValid: importFolders.length,
      newTasks: newTasks.length,
      duplicates: duplicates.length,
      invalid: 0,
      tasks: newTasks.concat(duplicates.map(d => ({
        ...d,
        isValid: true,
        isDuplicate: true,
        errors: []
      }))),
      scanTime: new Date() - startTime
    };
  } catch (error) {
    throw new Error(`Fast preview failed: ${error.message}`);
  }
}