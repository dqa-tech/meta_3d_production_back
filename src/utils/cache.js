/**
 * Drive metadata cache
 * Reduces API calls by caching file and folder metadata
 */

/**
 * Create a new cache instance
 * @returns {Object} Cache instance
 */
function createDriveCache() {
  return {
    folders: {},
    files: {},
    filesByFolder: {},
    
    /**
     * Clear all cached data
     */
    clear() {
      this.folders = {};
      this.files = {};
      this.filesByFolder = {};
    },
    
    /**
     * Cache folder metadata
     * @param {Object} folder - Folder object
     */
    addFolder(folder) {
      this.folders[folder.id] = folder;
    },
    
    /**
     * Cache file metadata
     * @param {Object} file - File object
     */
    addFile(file) {
      this.files[file.id] = file;
      
      // Also index by parent folder
      if (file.parents && file.parents.length > 0) {
        const parentId = file.parents[0];
        if (!this.filesByFolder[parentId]) {
          this.filesByFolder[parentId] = [];
        }
        this.filesByFolder[parentId].push(file);
      }
    },
    
    /**
     * Get folder from cache
     * @param {string} folderId - Folder ID
     * @returns {Object|null} Folder object or null
     */
    getFolder(folderId) {
      return this.folders[folderId] || null;
    },
    
    /**
     * Get file from cache
     * @param {string} fileId - File ID
     * @returns {Object|null} File object or null
     */
    getFile(fileId) {
      return this.files[fileId] || null;
    },
    
    /**
     * Get files in folder from cache
     * @param {string} folderId - Folder ID
     * @returns {Array} Files in folder
     */
    getFilesInFolder(folderId) {
      return this.filesByFolder[folderId] || [];
    },
    
    /**
     * Bulk load folder contents into cache
     * @param {string} parentId - Parent folder ID
     */
    bulkLoadFolder(parentId) {
      const items = bulkListFiles(parentId);
      
      items.forEach(item => {
        if (item.mimeType === 'application/vnd.google-apps.folder') {
          this.addFolder(item);
        } else {
          this.addFile(item);
        }
      });
      
      return items;
    },
    
    /**
     * Check if folder has required files
     * @param {string} folderId - Folder ID
     * @param {Array<string>} requiredFiles - Required file names
     * @returns {boolean} True if all required files exist
     */
    hasRequiredFiles(folderId, requiredFiles) {
      const files = this.getFilesInFolder(folderId);
      const fileNames = new Set(files.map(f => f.name));
      return requiredFiles.every(name => fileNames.has(name));
    },
    
    /**
     * Get cache statistics
     * @returns {Object} Cache stats
     */
    getStats() {
      return {
        folders: Object.keys(this.folders).length,
        files: Object.keys(this.files).length,
        indexedFolders: Object.keys(this.filesByFolder).length
      };
    }
  };
}

/**
 * Global cache instance
 */
let globalDriveCache = null;

/**
 * Get or create global cache
 * @returns {Object} Cache instance
 */
function getDriveCache() {
  if (!globalDriveCache) {
    globalDriveCache = createDriveCache();
  }
  return globalDriveCache;
}

/**
 * Clear global cache
 */
function clearDriveCache() {
  if (globalDriveCache) {
    globalDriveCache.clear();
  }
}