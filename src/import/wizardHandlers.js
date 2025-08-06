/**
 * Import wizard server-side functions
 * Handles communication between UI and backend
 */

/**
 * Get production folder ID from settings
 * @returns {string} Production folder ID
 */
function getProductionFolderId() {
  // TODO: Implement settings storage
  // For now, return a placeholder that needs to be configured
  const scriptProperties = PropertiesService.getScriptProperties();
  const folderId = scriptProperties.getProperty('PRODUCTION_FOLDER_ID');
  
  if (!folderId) {
    throw new Error('Production folder not configured. Please set up in Settings.');
  }
  
  return folderId;
}

/**
 * Show folder picker dialog
 * @returns {Object} Selected folder info
 */
function showFolderPicker() {
  try {
    // This would ideally use the Picker API, but for now we'll use a simple prompt
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
      'Select Import Folder',
      'Please enter the Google Drive folder ID or URL:',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (result.getSelectedButton() === ui.Button.OK) {
      const input = result.getResponseText().trim();
      
      // Extract folder ID from URL if provided
      let folderId = input;
      const urlMatch = input.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (urlMatch) {
        folderId = urlMatch[1];
      }
      
      // Validate folder exists and user has access
      try {
        const folder = DriveApp.getFolderById(folderId);
        return {
          id: folder.getId(),
          name: folder.getName(),
          url: folder.getUrl()
        };
      } catch (error) {
        throw new Error('Invalid folder ID or no access to folder');
      }
    }
    
    return null;
  } catch (error) {
    throw new Error(`Failed to select folder: ${error.message}`);
  }
}

/**
 * Scan import folder (wrapper for UI)
 * @param {string} importFolderId - Import folder ID
 * @param {string} productionFolderId - Production folder ID
 * @returns {Object} Scan results
 */
function scanImportFolder(importFolderId, productionFolderId) {
  try {
    return previewImport(importFolderId, productionFolderId);
  } catch (err) {
    error('Import scan failed', {
      importFolder: importFolderId,
      error: err.message || err.toString()
    });
    throw err;
  }
}

/**
 * Execute import (wrapper for UI) - Using optimized batch import
 * @param {string} importFolderId - Import folder ID
 * @param {string} productionFolderId - Production folder ID
 * @param {string} batchName - Optional batch name
 * @param {string} group - Group assignment
 * @returns {Object} Import results
 */
function executeImport(importFolderId, productionFolderId, batchName, group) {
  try {
    // Use the new optimized batch import
    const result = performBatchImport(importFolderId, productionFolderId, batchName, group || 'A');
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    return result;
  } catch (err) {
    // Return error in a format the UI can handle
    return {
      batch: {
        id: 'ERROR_' + new Date().getTime(),
        duration: 0,
        group: group || 'A'
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
 * Include HTML file content
 * @param {string} filename - HTML file to include
 * @returns {string} HTML content
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Create HTML template from file
 * @param {string} filename - Template file
 * @returns {HtmlOutput} HTML output
 */
function createHtmlTemplate(filename) {
  return HtmlService.createTemplateFromFile(filename);
}

/**
 * Configure production folder
 * @param {string} folderId - Production folder ID
 */
function setProductionFolder(folderId) {
  try {
    // Validate folder
    const folder = DriveApp.getFolderById(folderId);
    
    // Check write access
    if (!canWrite(folderId)) {
      throw new Error('No write access to production folder');
    }
    
    // Save to script properties
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty('PRODUCTION_FOLDER_ID', folderId);
    scriptProperties.setProperty('PRODUCTION_FOLDER_NAME', folder.getName());
    
    info('Production folder configured', {
      id: folderId,
      name: folder.getName()
    });
    
    return true;
  } catch (error) {
    throw new Error(`Failed to set production folder: ${error.message}`);
  }
}