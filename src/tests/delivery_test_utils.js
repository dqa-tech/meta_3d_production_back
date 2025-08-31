/**
 * Delivery Test Utilities
 * Simple folder structure copying for delivery testing
 */

// Configuration constants
const TEST_STAGING_FOLDER = PropertiesService.getScriptProperties().getProperty('TEST_STAGING_FOLDER');
const TEST_EXPORT_FOLDER = PropertiesService.getScriptProperties().getProperty('TEST_EXPORT_FOLDER');

/**
 * Copy staging folder structure (empty folders only) to target location
 * @param {string} stagingFolderId - Drive ID of staged batch folder
 * @param {string} targetFolderId - Drive ID where to create the copy
 * @returns {Object} Result object with folder information
 */
function copyFolderStructure(stagingFolderId, targetFolderId) {
  try {
    const stagingFolder = DriveApp.getFolderById(stagingFolderId);
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    
    // Create copy with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const copyFolderName = `COPY_${stagingFolder.getName()}_${timestamp}`;
    
    const copyMainFolder = targetFolder.createFolder(copyFolderName);
    
    // Copy all subfolders (empty)
    const stagingSubfolders = stagingFolder.getFolders();
    const createdFolders = [];
    
    while (stagingSubfolders.hasNext()) {
      const taskFolder = stagingSubfolders.next();
      const taskFolderName = taskFolder.getName();
      
      // Skip system folders
      if (taskFolderName.startsWith('.') || taskFolderName.startsWith('_')) {
        continue;
      }
      
      // Create empty folder copy
      const newTaskFolder = copyMainFolder.createFolder(taskFolderName);
      createdFolders.push({
        name: taskFolderName,
        id: newTaskFolder.getId()
      });
    }
    
    return {
      success: true,
      copyFolderName: copyFolderName,
      copyFolderId: copyMainFolder.getId(),
      copyFolderUrl: copyMainFolder.getUrl(),
      createdFolders: createdFolders,
      totalFolders: createdFolders.length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick copy using configured folder IDs
 * @returns {Object} Result object
 */
function quickFolderCopy() {
  if (!TEST_STAGING_FOLDER || !TEST_EXPORT_FOLDER) {
    return {
      success: false,
      error: 'TEST_STAGING_FOLDER and TEST_EXPORT_FOLDER must be set in script properties'
    };
  }
  
  return copyFolderStructure(TEST_STAGING_FOLDER, TEST_EXPORT_FOLDER);
}

/**
 * Delete folders that start with specific prefix
 * @param {string} targetFolderId - Drive ID of folder containing folders to delete
 * @param {string} prefix - Prefix of folders to delete (default: 'COPY_')
 * @returns {Object} Cleanup result
 */
function deleteFoldersWithPrefix(targetFolderId, prefix = 'COPY_') {
  try {
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    const subfolders = targetFolder.getFolders();
    const deletedFolders = [];
    
    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      const folderName = folder.getName();
      
      if (folderName.startsWith(prefix)) {
        folder.setTrashed(true);
        deletedFolders.push({
          name: folderName,
          id: folder.getId()
        });
      }
    }
    
    return {
      success: true,
      deletedFolders: deletedFolders,
      deletedCount: deletedFolders.length
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Quick cleanup using configured export folder
 * @returns {Object} Cleanup result
 */
function quickCleanup() {
  if (!TEST_EXPORT_FOLDER) {
    return {
      success: false,
      error: 'TEST_EXPORT_FOLDER must be set in script properties'
    };
  }
  
  return deleteFoldersWithPrefix(TEST_EXPORT_FOLDER, 'COPY_');
}