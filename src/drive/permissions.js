/**
 * Drive permissions management
 * Handle sharing and access control
 */

/**
 * Share folder with user
 * @param {string} folderId - Folder ID
 * @param {string} email - User email
 * @param {string} role - Permission role (viewer, commenter, editor)
 * @returns {boolean} Success status
 */
function shareFolder(folderId, email, role = 'viewer') {
  try {
    const folder = DriveApp.getFolderById(folderId);
    
    switch (role.toLowerCase()) {
      case 'viewer':
        folder.addViewer(email);
        break;
      case 'commenter':
        folder.addCommenter(email);
        break;
      case 'editor':
        folder.addEditor(email);
        break;
      default:
        throw new Error(`Invalid role: ${role}`);
    }
    
    info(`Shared folder ${folderId} with ${email} as ${role}`);
    return true;
  } catch (error) {
    throw new DriveError(`Failed to share folder: ${error.message}`, 'shareFolder', folderId);
  }
}

/**
 * Remove user access from folder
 * @param {string} folderId - Folder ID
 * @param {string} email - User email
 * @returns {boolean} Success status
 */
function removeAccess(folderId, email) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    
    folder.removeViewer(email);
    folder.removeCommenter(email);
    folder.removeEditor(email);
    
    info(`Removed ${email} access from folder ${folderId}`);
    return true;
  } catch (error) {
    // It's OK if user didn't have access
    if (!error.message.includes('does not have permission')) {
      throw new DriveError(`Failed to remove access: ${error.message}`, 'removeAccess', folderId);
    }
    return true;
  }
}

/**
 * Get folder permissions
 * @param {string} folderId - Folder ID
 * @returns {Object} Permissions object
 */
function getFolderPermissions(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    
    return {
      owner: folder.getOwner().getEmail(),
      editors: folder.getEditors().map(user => user.getEmail()),
      viewers: folder.getViewers().map(user => user.getEmail()),
      isShareable: folder.isShareable(),
      access: folder.getAccess(Session.getActiveUser())
    };
  } catch (error) {
    throw new DriveError(`Failed to get permissions: ${error.message}`, 'getFolderPermissions', folderId);
  }
}

/**
 * Check if user has write access to folder
 * @param {string} folderId - Folder ID
 * @returns {boolean} True if user can write
 */
function canWrite(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const access = folder.getAccess(Session.getActiveUser());
    
    return access === DriveApp.Permission.OWNER || 
           access === DriveApp.Permission.EDIT;
  } catch (error) {
    return false;
  }
}

/**
 * Check if user has read access to folder
 * @param {string} folderId - Folder ID
 * @returns {boolean} True if user can read
 */
function canRead(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const access = folder.getAccess(Session.getActiveUser());
    
    return access !== DriveApp.Permission.NONE;
  } catch (error) {
    return false;
  }
}

/**
 * Set folder to be publicly viewable
 * @param {string} folderId - Folder ID
 * @returns {string} Public URL
 */
function makePublic(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    folder.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
    
    return folder.getUrl();
  } catch (error) {
    throw new DriveError(`Failed to make folder public: ${error.message}`, 'makePublic', folderId);
  }
}

/**
 * Restrict folder to domain only
 * @param {string} folderId - Folder ID
 * @param {string} domain - Domain to restrict to
 * @returns {boolean} Success status
 */
function restrictToDomain(folderId, domain) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    folder.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
    
    info(`Restricted folder ${folderId} to domain ${domain}`);
    return true;
  } catch (error) {
    throw new DriveError(`Failed to restrict folder: ${error.message}`, 'restrictToDomain', folderId);
  }
}