/**
 * Drive API operations
 * Core file and folder operations with batch support
 */

/**
 * Get folder by ID
 * @param {string} folderId - Folder ID
 * @returns {Object} Folder object
 */
function getFolder(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    return {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl(),
      parent: folder.getParents().hasNext() ? folder.getParents().next().getId() : null
    };
  } catch (error) {
    throw new DriveError(`Failed to get folder: ${error.message}`, 'getFolder', folderId);
  }
}

/**
 * List folders in a parent folder
 * @param {string} parentFolderId - Parent folder ID
 * @param {string} pattern - Optional name pattern to match
 * @returns {Array} Array of folder objects
 */
function listFolders(parentFolderId, pattern = null) {
  try {
    const parent = DriveApp.getFolderById(parentFolderId);
    const folders = parent.getFolders();
    const result = [];
    
    while (folders.hasNext()) {
      const folder = folders.next();
      const name = folder.getName();
      
      if (!pattern || name.match(pattern)) {
        result.push({
          id: folder.getId(),
          name: name,
          url: folder.getUrl()
        });
      }
    }
    
    return result;
  } catch (error) {
    throw new DriveError(`Failed to list folders: ${error.message}`, 'listFolders', parentFolderId);
  }
}

/**
 * List files in a folder
 * @param {string} folderId - Folder ID
 * @param {Array<string>} fileNames - Optional specific file names to look for
 * @returns {Array} Array of file objects
 */
function listFiles(folderId, fileNames = null) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const result = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName();
      
      if (!fileNames || fileNames.includes(name)) {
        result.push({
          id: file.getId(),
          name: name,
          url: file.getUrl(),
          mimeType: file.getMimeType(),
          size: file.getSize()
        });
      }
    }
    
    return result;
  } catch (error) {
    throw new DriveError(`Failed to list files: ${error.message}`, 'listFiles', folderId);
  }
}

/**
 * Create folder
 * @param {string} name - Folder name
 * @param {string} parentFolderId - Parent folder ID
 * @returns {Object} Created folder object
 */
function createFolder(name, parentFolderId) {
  try {
    const parent = DriveApp.getFolderById(parentFolderId);
    const folder = parent.createFolder(name);
    
    return {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl()
    };
  } catch (error) {
    throw new DriveError(`Failed to create folder: ${error.message}`, 'createFolder', parentFolderId);
  }
}

/**
 * Copy file to another folder
 * @param {string} fileId - File ID to copy
 * @param {string} targetFolderId - Target folder ID
 * @param {string} newName - Optional new name
 * @returns {Object} Copied file object
 */
function copyFile(fileId, targetFolderId, newName = null) {
  try {
    const file = DriveApp.getFileById(fileId);
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    const copy = file.makeCopy(newName || file.getName(), targetFolder);
    
    return {
      id: copy.getId(),
      name: copy.getName(),
      url: copy.getUrl(),
      mimeType: copy.getMimeType()
    };
  } catch (error) {
    throw new DriveError(`Failed to copy file: ${error.message}`, 'copyFile', fileId);
  }
}

/**
 * Copy entire folder with contents
 * @param {string} sourceFolderId - Source folder ID
 * @param {string} targetParentId - Target parent folder ID
 * @param {string} newName - Optional new name for copied folder
 * @returns {Object} Copied folder object with file mappings
 */
function copyFolder(sourceFolderId, targetParentId, newName = null) {
  try {
    const sourceFolder = DriveApp.getFolderById(sourceFolderId);
    const targetParent = DriveApp.getFolderById(targetParentId);
    const folderName = newName || sourceFolder.getName();
    
    // Create new folder
    const newFolder = targetParent.createFolder(folderName);
    
    // Copy all files
    const files = sourceFolder.getFiles();
    const fileMappings = [];
    
    while (files.hasNext()) {
      const file = files.next();
      const copy = file.makeCopy(file.getName(), newFolder);
      
      fileMappings.push({
        original: {
          id: file.getId(),
          name: file.getName()
        },
        copy: {
          id: copy.getId(),
          name: copy.getName(),
          url: copy.getUrl()
        }
      });
    }
    
    return {
      folder: {
        id: newFolder.getId(),
        name: newFolder.getName(),
        url: newFolder.getUrl()
      },
      files: fileMappings
    };
  } catch (error) {
    throw new DriveError(`Failed to copy folder: ${error.message}`, 'copyFolder', sourceFolderId);
  }
}

/**
 * Move file to another folder
 * @param {string} fileId - File ID
 * @param {string} targetFolderId - Target folder ID
 * @returns {Object} Moved file object
 */
function moveFile(fileId, targetFolderId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    
    // Remove from current parents
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      parent.removeFile(file);
    }
    
    // Add to new parent
    targetFolder.addFile(file);
    
    return {
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      parentId: targetFolderId
    };
  } catch (error) {
    throw new DriveError(`Failed to move file: ${error.message}`, 'moveFile', fileId);
  }
}

/**
 * Check if folder exists
 * @param {string} folderId - Folder ID
 * @returns {boolean} True if exists
 */
function folderExists(folderId) {
  try {
    DriveApp.getFolderById(folderId);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get file metadata
 * @param {string} fileId - File ID
 * @returns {Object} File metadata
 */
function getFileMetadata(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    
    return {
      id: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      created: file.getDateCreated(),
      lastUpdated: file.getLastUpdated(),
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl()
    };
  } catch (error) {
    throw new DriveError(`Failed to get file metadata: ${error.message}`, 'getFileMetadata', fileId);
  }
}

/**
 * Batch create folders using Drive API v3
 * @param {string} parentId - Parent folder ID
 * @param {Array<string>} folderNames - Folder names to create
 * @returns {Array} Created folder objects
 */
function batchCreateFoldersOptimized(parentId, folderNames) {
  if (!folderNames || folderNames.length === 0) {
    return [];
  }
  
  // Use the batch operations from batch.js
  return batchCreateFolders(parentId, folderNames);
}

/**
 * Batch copy files with parallel processing
 * @param {Array} mappings - Array of {fileId, targetFolderId, newName}
 * @returns {Array} Copied file objects
 */
function batchCopyFilesOptimized(mappings) {
  if (!mappings || mappings.length === 0) {
    return [];
  }
  
  // Use the batch operations from batch.js
  return batchCopyFiles(mappings);
}

/**
 * Bulk get metadata for multiple files
 * @param {Array<string>} fileIds - File IDs
 * @returns {Array} File metadata objects
 */
function bulkGetMetadata(fileIds) {
  if (!fileIds || fileIds.length === 0) {
    return [];
  }
  
  // Use the batch operations from batch.js
  return batchGetMetadata(fileIds);
}

/**
 * Fast list all children in folder
 * @param {string} parentId - Parent folder ID
 * @param {string} mimeType - Optional MIME type filter
 * @returns {Array} All matching items
 */
function bulkListChildren(parentId, mimeType = null) {
  return bulkListFiles(parentId, { mimeType: mimeType });
}