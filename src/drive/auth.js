/**
 * Drive authentication helpers
 * Handle OAuth and service account authentication
 */

/**
 * Get current user info
 * @returns {Object} User information
 */
function getCurrentUser() {
  try {
    const user = Session.getActiveUser();
    const email = user.getEmail();
    
    if (!email) {
      throw new Error('Unable to get user email. Please ensure proper authorization.');
    }
    
    return {
      email: email,
      domain: email.split('@')[1]
    };
  } catch (error) {
    throw new DriveError(`Authentication failed: ${error.message}`, 'getCurrentUser');
  }
}

/**
 * Check if user is authorized
 * @returns {boolean} True if authorized
 */
function isAuthorized() {
  try {
    const email = Session.getActiveUser().getEmail();
    return !!email;
  } catch (error) {
    return false;
  }
}

/**
 * Request Drive authorization
 * @returns {boolean} True if authorized
 */
function requestAuthorization() {
  try {
    // This will trigger authorization prompt if needed
    DriveApp.getRootFolder();
    return true;
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'Authorization Required',
      'Please authorize this application to access your Google Drive.',
      ui.ButtonSet.OK
    );
    return false;
  }
}

/**
 * Get OAuth token for API calls
 * @returns {string} OAuth token
 */
function getOAuthToken() {
  try {
    return ScriptApp.getOAuthToken();
  } catch (error) {
    throw new DriveError(`Failed to get OAuth token: ${error.message}`, 'getOAuthToken');
  }
}

/**
 * Check if running with required scopes
 * @returns {Array<string>} Available scopes
 */
function getAvailableScopes() {
  // These are the typical scopes needed
  const requiredScopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
  ];
  
  try {
    // Test operations to verify scopes
    DriveApp.getRootFolder();
    SpreadsheetApp.getActiveSpreadsheet();
    
    return requiredScopes;
  } catch (error) {
    warn('Some scopes may be missing', { error: error.message });
    return [];
  }
}

/**
 * Verify user has access to production folder
 * @param {string} productionFolderId - Production folder ID
 * @returns {boolean} True if has access
 */
function verifyProductionAccess(productionFolderId) {
  if (!productionFolderId) {
    warn('No production folder ID configured');
    return false;
  }
  
  try {
    const folder = DriveApp.getFolderById(productionFolderId);
    const access = folder.getAccess(Session.getActiveUser());
    
    if (access === DriveApp.Permission.NONE) {
      throw new Error('No access to production folder');
    }
    
    if (access === DriveApp.Permission.VIEW) {
      warn('Only view access to production folder');
      return false;
    }
    
    return true;
  } catch (error) {
    error('Production folder access check failed', { 
      folderId: productionFolderId,
      error: error.message 
    });
    return false;
  }
}