/**
 * Settings management functions
 * Configure system settings like production folder
 */

/**
 * Configure staging folder via dialog
 */
function configureStagingFolder() {
  const ui = SpreadsheetApp.getUi();
  
  // Get current setting
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentFolderId = scriptProperties.getProperty('STAGING_FOLDER_ID');
  
  let prompt = 'Enter the Google Drive folder ID or URL for the staging folder:';
  if (currentFolderId) {
    try {
      const currentFolder = DriveApp.getFolderById(currentFolderId);
      prompt += '\n\nCurrent: ' + currentFolder.getName();
    } catch (e) {
      prompt += '\n\nCurrent folder ID is invalid!';
    }
  }
  
  const result = ui.prompt(
    'Configure Staging Folder',
    prompt,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() === ui.Button.OK) {
    const input = result.getResponseText().trim();
    
    if (!input) {
      ui.alert('Error', 'No folder ID provided', ui.ButtonSet.OK);
      return;
    }
    
    // Extract folder ID from URL if provided
    let folderId = input;
    const urlMatch = input.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      folderId = urlMatch[1];
    }
    
    try {
      // Validate folder exists and we have access
      const folder = DriveApp.getFolderById(folderId);
      
      // Test write access by creating and deleting a test folder
      const testFolder = folder.createFolder('__staging_test__');
      testFolder.setTrashed(true);
      
      // Save to script properties
      scriptProperties.setProperty('STAGING_FOLDER_ID', folderId);
      scriptProperties.setProperty('STAGING_FOLDER_NAME', folder.getName());
      
      ui.alert(
        'Success',
        `Staging folder set to: ${folder.getName()}\n\nThis folder will be used to stage exports before client delivery.`,
        ui.ButtonSet.OK
      );
      
      info('Staging folder configured', {
        id: folderId,
        name: folder.getName()
      });
      
    } catch (error) {
      ui.alert(
        'Error',
        'Invalid folder ID or no write access to folder: ' + error.message,
        ui.ButtonSet.OK
      );
    }
  }
}

/**
 * Configure production folder via dialog
 */
function configureProductionFolder() {
  const ui = SpreadsheetApp.getUi();
  
  // Get current setting
  const scriptProperties = PropertiesService.getScriptProperties();
  const currentFolderId = scriptProperties.getProperty('PRODUCTION_FOLDER_ID');
  
  let prompt = 'Enter the Google Drive folder ID or URL for the production folder:';
  if (currentFolderId) {
    try {
      const currentFolder = DriveApp.getFolderById(currentFolderId);
      prompt += '\n\nCurrent: ' + currentFolder.getName();
    } catch (e) {
      prompt += '\n\nCurrent folder ID is invalid!';
    }
  }
  
  const result = ui.prompt(
    'Configure Production Folder',
    prompt,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() === ui.Button.OK) {
    const input = result.getResponseText().trim();
    
    if (!input) {
      ui.alert('Error', 'No folder ID provided', ui.ButtonSet.OK);
      return;
    }
    
    // Extract folder ID from URL if provided
    let folderId = input;
    const urlMatch = input.match(/folders\/([a-zA-Z0-9-_]+)/);
    if (urlMatch) {
      folderId = urlMatch[1];
    }
    
    try {
      // Validate folder exists and we have access
      const folder = DriveApp.getFolderById(folderId);
      
      // Save to script properties
      scriptProperties.setProperty('PRODUCTION_FOLDER_ID', folderId);
      scriptProperties.setProperty('PRODUCTION_FOLDER_NAME', folder.getName());
      
      ui.alert(
        'Success',
        `Production folder set to: ${folder.getName()}`,
        ui.ButtonSet.OK
      );
      
      info('Production folder configured', {
        id: folderId,
        name: folder.getName()
      });
      
    } catch (error) {
      ui.alert(
        'Error',
        'Invalid folder ID or no access to folder: ' + error.message,
        ui.ButtonSet.OK
      );
    }
  }
}

/**
 * Show current settings
 */
function showCurrentSettings() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  let message = 'Current Settings:\n\n';
  
  // Production folder
  const productionFolderId = scriptProperties.getProperty('PRODUCTION_FOLDER_ID');
  if (productionFolderId) {
    try {
      const folder = DriveApp.getFolderById(productionFolderId);
      message += `Production Folder: ${folder.getName()}\n`;
      message += `Folder ID: ${productionFolderId}\n`;
      message += `URL: ${folder.getUrl()}\n\n`;
    } catch (e) {
      message += `Production Folder: ERROR - Invalid folder ID\n\n`;
    }
  } else {
    message += `Production Folder: Not configured\n\n`;
  }
  
  // Staging folder
  const stagingFolderId = scriptProperties.getProperty('STAGING_FOLDER_ID');
  if (stagingFolderId) {
    try {
      const folder = DriveApp.getFolderById(stagingFolderId);
      message += `Staging Folder: ${folder.getName()}\n`;
      message += `Folder ID: ${stagingFolderId}\n`;
      message += `URL: ${folder.getUrl()}\n\n`;
    } catch (e) {
      message += `Staging Folder: ERROR - Invalid folder ID\n\n`;
    }
  } else {
    message += `Staging Folder: Not configured\n\n`;
  }
  
  // API Key
  const apiKey = scriptProperties.getProperty('API_KEY');
  if (apiKey) {
    message += `API Key: ${apiKey}\n\n`;
  }
  
  // Other settings
  const maxConcurrent = scriptProperties.getProperty('MAX_CONCURRENT_TASKS');
  if (maxConcurrent) {
    message += `Max Concurrent Tasks per Agent: ${maxConcurrent}\n`;
  }
  
  const allowedBatches = scriptProperties.getProperty('ALLOWED_BATCHES');
  if (allowedBatches) {
    message += `Allowed Batches: ${allowedBatches}\n`;
  }
  
  ui.alert('System Settings', message, ui.ButtonSet.OK);
}

/**
 * Configure review threshold
 */
function configureReviewThreshold() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  const currentThreshold = scriptProperties.getProperty('REVIEW_PASS_THRESHOLD') || '80';
  
  const result = ui.prompt(
    'Configure Review Pass Threshold',
    `Enter the minimum score (0-100) for tasks to pass review:\n\nCurrent threshold: ${currentThreshold}`,
    ui.ButtonSet.OK_CANCEL
  );
  
  if (result.getSelectedButton() === ui.Button.OK) {
    const input = result.getResponseText().trim();
    const threshold = parseInt(input);
    
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      ui.alert('Error', 'Threshold must be a number between 0 and 100', ui.ButtonSet.OK);
      return;
    }
    
    scriptProperties.setProperty('REVIEW_PASS_THRESHOLD', threshold.toString());
    
    ui.alert(
      'Success',
      `Review pass threshold set to: ${threshold}`,
      ui.ButtonSet.OK
    );
  }
}

/**
 * Get review pass threshold
 * @returns {number} Threshold score (default: 80)
 */
function getReviewThreshold() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const threshold = scriptProperties.getProperty('REVIEW_PASS_THRESHOLD');
  return threshold ? parseInt(threshold) : 80;
}

/**
 * Clear all settings (use with caution!)
 */
function clearAllSettings() {
  const ui = SpreadsheetApp.getUi();
  
  const result = ui.alert(
    'Warning',
    'This will clear ALL system settings. Are you sure?',
    ui.ButtonSet.YES_NO
  );
  
  if (result === ui.Button.YES) {
    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.deleteAllProperties();
    
    ui.alert('Success', 'All settings have been cleared', ui.ButtonSet.OK);
  }
}