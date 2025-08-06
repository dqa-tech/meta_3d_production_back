/**
 * Import folder scanner - Optimized
 * Fast bulk scanning using Drive API v3 and caching
 */

const REQUIRED_FILES = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];

/**
 * Fast scan import folder using bulk operations
 * @param {string} importFolderId - Import folder ID
 * @returns {Object} Scan results with validation
 */
function scanImportFolder(importFolderId) {
  info('Starting bulk folder scan', { folderId: importFolderId });
  
  try {
    const cache = createDriveCache();
    
    // Single API call to get all items
    const allItems = cache.bulkLoadFolder(importFolderId);
    
    // Separate folders and files
    const folders = allItems.filter(item => 
      item.mimeType === 'application/vnd.google-apps.folder'
    );
    
    // Process each folder
    const validTasks = [];
    const invalidTasks = [];
    
    folders.forEach(folder => {
      const validation = quickValidateFolder(folder, cache);
      
      if (validation.isValid) {
        validTasks.push(validation);
      } else {
        invalidTasks.push(validation);
      }
    });
    
    info('Scan complete', {
      valid: validTasks.length,
      invalid: invalidTasks.length
    });
    
    return {
      valid: validTasks,
      invalid: invalidTasks,
      summary: {
        totalFolders: folders.length,
        validCount: validTasks.length,
        invalidCount: invalidTasks.length
      }
    };
  } catch (error) {
    throw new DriveError(`Failed to scan import folder: ${error.message}`, 'scanImportFolder', importFolderId);
  }
}

/**
 * Quick validate folder using cache
 * @param {Object} folder - Folder object
 * @param {Object} cache - Drive cache instance
 * @returns {Object} Validation result
 */
function quickValidateFolder(folder, cache) {
  // Get folder files from Drive API
  const files = bulkListFiles(folder.id);
  
  // Cache the files
  files.forEach(file => cache.addFile(file));
  
  const result = {
    id: folder.id,
    name: folder.name,
    url: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
    isValid: false,
    errors: [],
    files: {}
  };
  
  // Build file map
  const fileMap = {};
  files.forEach(file => {
    if (REQUIRED_FILES.includes(file.name)) {
      fileMap[file.name] = {
        id: file.id,
        name: file.name,
        size: file.size || 0,
        mimeType: file.mimeType
      };
    }
  });
  
  // Check for required files
  for (const requiredFile of REQUIRED_FILES) {
    if (!fileMap[requiredFile]) {
      result.errors.push(`Missing required file: ${requiredFile}`);
    }
  }
  
  // Verify file types
  Object.entries(fileMap).forEach(([fileName, fileInfo]) => {
    if (fileInfo.mimeType && !fileInfo.mimeType.startsWith('image/')) {
      result.errors.push(`${fileName} is not an image file`);
    }
  });
  
  result.files = fileMap;
  result.isValid = result.errors.length === 0;
  
  return result;
}

/**
 * Fast preview import operation
 * @param {string} importFolderId - Import folder ID
 * @param {string} productionFolderId - Production folder ID
 * @returns {Object} Import preview
 */
function previewImport(importFolderId, productionFolderId) {
  const startTime = new Date();
  
  try {
    // Use bulk operations for speed
    const importItems = Drive.Files.list({
      q: `'${importFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1000,
      supportsAllDrives: true
    }).files || [];
    
    const productionItems = Drive.Files.list({
      q: `'${productionFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(name)',
      pageSize: 1000,
      supportsAllDrives: true
    }).files || [];
    
    // Create set of existing names for O(1) lookup
    const existingNames = new Set(productionItems.map(item => item.name));
    
    // Categorize tasks
    const newTasks = [];
    const duplicates = [];
    
    importItems.forEach(folder => {
      if (existingNames.has(folder.name)) {
        duplicates.push({
          id: folder.id,
          name: folder.name,
          isDuplicate: true
        });
      } else {
        newTasks.push({
          id: folder.id,
          name: folder.name,
          isDuplicate: false,
          isValid: true,
          errors: []
        });
      }
    });
    
    return {
      canImport: newTasks.length > 0,
      message: `Found ${newTasks.length} new tasks to import`,
      totalValid: importItems.length,
      newTasks: newTasks.length,
      duplicates: duplicates.length,
      invalid: 0,
      tasks: newTasks.concat(duplicates.map(d => ({
        ...d,
        isValid: true,
        errors: []
      }))),
      scanTime: new Date() - startTime
    };
  } catch (error) {
    throw new Error(`Preview failed: ${error.message}`);
  }
}