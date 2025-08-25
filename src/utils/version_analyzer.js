/**
 * Version Conflict Analyzer
 * Scans production folder for file versioning issues
 */

/**
 * Scan production folder for version conflicts
 * Returns high-level analysis with sample folder URLs
 * @param {number} startIndex - Starting folder index (0-based)
 * @param {number} batchSize - Number of folders to scan in this batch
 */
function scanVersionConflicts(startIndex = 0, batchSize = 700) {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const productionFolderId = scriptProperties.getProperty('PRODUCTION_FOLDER_ID');
    
    if (!productionFolderId) {
      throw new Error('Production folder not configured');
    }
    
    const productionFolder = DriveApp.getFolderById(productionFolderId);
    const taskFolders = productionFolder.getFolders();
    
    const analysis = {
      batchInfo: {
        startIndex: startIndex,
        batchSize: batchSize,
        scannedInBatch: 0
      },
      totalFoldersScanned: 0,
      foldersWithConflicts: 0,
      totalConflicts: 0,
      conflictTypes: {
        duplicateVersions: 0,
        missingVersions: 0,
        invalidVersions: 0
      },
      sampleFolders: []
    };
    
    // Skip to start index
    let currentIndex = 0;
    while (taskFolders.hasNext() && currentIndex < startIndex) {
      taskFolders.next();
      currentIndex++;
    }
    
    // Scan folders in batch
    while (taskFolders.hasNext() && analysis.batchInfo.scannedInBatch < batchSize) {
      const folder = taskFolders.next();
      analysis.batchInfo.scannedInBatch++;
      analysis.totalFoldersScanned = startIndex + analysis.batchInfo.scannedInBatch;
      
      try {
        const folderConflicts = analyzeFolderForConflicts(folder);
        
        if (folderConflicts.hasConflicts) {
          analysis.foldersWithConflicts++;
          analysis.totalConflicts += folderConflicts.conflictCount;
          
          // Add to conflict type counts
          analysis.conflictTypes.duplicateVersions += folderConflicts.duplicateVersions;
          analysis.conflictTypes.missingVersions += folderConflicts.missingVersions;
          analysis.conflictTypes.invalidVersions += folderConflicts.invalidVersions;
          
          // Add to sample folders (max 5)
          if (analysis.sampleFolders.length < 5) {
            analysis.sampleFolders.push({
              name: folder.getName(),
              url: folder.getUrl(),
              conflicts: folderConflicts.conflictDetails
            });
          }
        }
        
      } catch (folderError) {
        console.error(`Error processing folder ${folder.getName()}:`, folderError);
        throw folderError; // Re-throw to be caught by main try/catch
      }
      
      // Progress indicator for large scans
      if (analysis.batchInfo.scannedInBatch % 50 === 0) {
        console.log(`Batch progress: ${analysis.batchInfo.scannedInBatch}/${batchSize} (total index: ${analysis.totalFoldersScanned})`);
      }
    }
    
    // Add success flag to successful results
    analysis.success = true;
    return analysis;
    
  } catch (error) {
    console.error('=== DETAILED ERROR INFO ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error toString:', error.toString());
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('Stack trace:', error.stack);
    
    return {
      success: false,
      error: error.message || error.toString() || 'Unknown error occurred'
    };
  }
}

/**
 * Analyze a single folder for version conflicts
 * @param {GoogleAppsScript.Drive.Folder} folder - Folder to analyze
 * @returns {Object} Conflict analysis for this folder
 */
function analyzeFolderForConflicts(folder) {
  try {
    const files = folder.getFiles();
    const fileGroups = {};
    const conflicts = {
      hasConflicts: false,
      conflictCount: 0,
      duplicateVersions: 0,
      missingVersions: 0,
      invalidVersions: 0,
      conflictDetails: []
    };
  
  // Group files by pattern
  while (files.hasNext()) {
    const file = files.next();
    const fileName = file.getName();
    
    // Parse version info from filename
    const versionInfo = parseFileVersion(fileName);
    
    if (versionInfo) {
      const groupKey = `${versionInfo.folderName}_${versionInfo.type}`;
      
      if (!fileGroups[groupKey]) {
        fileGroups[groupKey] = [];
      }
      
      fileGroups[groupKey].push({
        file: file,
        fileName: fileName,
        version: versionInfo.version,
        major: versionInfo.major,
        minor: versionInfo.minor,
        lastUpdated: file.getLastUpdated()
      });
    }
  }
  
  // Check each group for conflicts
  Object.entries(fileGroups).forEach(([groupKey, groupFiles]) => {
    const groupConflicts = detectGroupConflicts(groupKey, groupFiles);
    
    if (groupConflicts.length > 0) {
      conflicts.hasConflicts = true;
      conflicts.conflictCount += groupConflicts.length;
      conflicts.conflictDetails.push(...groupConflicts);
      
      // Categorize conflict types
      groupConflicts.forEach(conflict => {
        switch (conflict.type) {
          case 'duplicate_version':
            conflicts.duplicateVersions++;
            break;
          case 'missing_version':
            conflicts.missingVersions++;
            break;
          case 'invalid_version':
            conflicts.invalidVersions++;
            break;
        }
      });
    }
  });
  
  return conflicts;
  
  } catch (error) {
    console.error('Error analyzing folder:', folder.getName(), error);
    return {
      hasConflicts: false,
      conflictCount: 0,
      duplicateVersions: 0,
      missingVersions: 0,
      invalidVersions: 0,
      conflictDetails: []
    };
  }
}

/**
 * Parse version information from filename
 * @param {string} fileName - File name to parse
 * @returns {Object|null} Version info or null if no pattern match
 */
function parseFileVersion(fileName) {
  // Pattern for versioned files: {folder_name}_{type}_v{major}.{minor?}.{extension}
  const patterns = [
    // Video files: folder_name_recording_v1.1.mp4
    /^(.+)_(recording)_v(\d+)(?:\.(\d+))?\.(.+)$/,
    // Other files: folder_name_alignment_v1.jpg
    /^(.+)_(alignment)_v(\d+)(?:\.(\d+))?\.(.+)$/,
    // OBJ files: folder_name_mesh_v1.obj
    /^(.+)_(mesh)_v(\d+)(?:\.(\d+))?\.obj$/
  ];
  
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match) {
      // All patterns now follow the same structure
      return {
        folderName: match[1],
        type: match[2], // 'recording', 'alignment', or 'mesh'
        version: match[3] + (match[4] ? `.${match[4]}` : ''),
        major: parseInt(match[3]),
        minor: match[4] ? parseInt(match[4]) : null
      };
    }
  }
  
  return null;
}

/**
 * Detect conflicts within a file group
 * @param {string} groupKey - Group identifier
 * @param {Array} groupFiles - Files in this group
 * @returns {Array} Array of conflicts found
 */
function detectGroupConflicts(groupKey, groupFiles) {
  const conflicts = [];
  const versionMap = {};
  
  // Map files by version
  groupFiles.forEach(fileInfo => {
    const versionKey = fileInfo.version;
    
    if (!versionMap[versionKey]) {
      versionMap[versionKey] = [];
    }
    
    versionMap[versionKey].push(fileInfo);
  });
  
  // Check for duplicate versions (same version, multiple files)
  Object.entries(versionMap).forEach(([version, files]) => {
    if (files.length > 1) {
      conflicts.push({
        type: 'duplicate_version',
        groupKey: groupKey,
        version: version,
        fileCount: files.length,
        files: files.map(f => f.fileName)
      });
    }
  });
  
  // Check for version gaps (missing sequential versions)
  const versions = Object.keys(versionMap).map(v => {
    const parts = v.split('.');
    return {
      original: v,
      major: parseInt(parts[0]),
      minor: parts[1] ? parseInt(parts[1]) : 0
    };
  }).sort((a, b) => {
    if (a.major === b.major) {
      return a.minor - b.minor;
    }
    return a.major - b.major;
  });
  
  // Simple gap detection for major versions
  const majorVersions = [...new Set(versions.map(v => v.major))].sort((a, b) => a - b);
  for (let i = 1; i < majorVersions.length; i++) {
    if (majorVersions[i] - majorVersions[i-1] > 1) {
      conflicts.push({
        type: 'missing_version',
        groupKey: groupKey,
        expectedVersion: majorVersions[i-1] + 1,
        foundVersion: majorVersions[i]
      });
    }
  }
  
  return conflicts;
}

/**
 * Create or update version analysis results sheet
 * @param {Object} analysis - Analysis results from scanVersionConflicts
 * @param {boolean} clearExisting - Whether to clear existing data
 */
function outputAnalysisToSheet(analysis, clearExisting = false) {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    console.log('Got spreadsheet:', spreadsheet.getName());
    
    let sheet;
    
    // Get or create the sheet
    sheet = spreadsheet.getSheetByName('Version Analysis');
    console.log('Existing sheet result:', sheet);
    
    if (!sheet) {
      console.log('Creating new sheet...');
      sheet = spreadsheet.insertSheet('Version Analysis');
      console.log('Created sheet result:', sheet);
    }
    
    // Verify sheet was created successfully
    if (!sheet) {
      throw new Error('Failed to create or access Version Analysis sheet');
    }
    
    console.log('Using sheet:', sheet.getName());
    
    if (clearExisting) {
      sheet.clear();
    }
    
    const lastRow = sheet.getLastRow();
    
    // Add headers if sheet is empty
    if (lastRow === 0) {
      const headers = [
        'Timestamp', 'Folder Name', 'Folder URL', 'Conflict Type',
        'Group Key', 'Version', 'File Count', 'Files', 'Expected Version', 'Found Version'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // Add analysis data
    const timestamp = new Date().toISOString();
    const rows = [];
    
    analysis.sampleFolders.forEach(folder => {
      folder.conflicts.forEach(conflict => {
        const row = [
          timestamp,
          folder.name,
          folder.url,
          conflict.type,
          conflict.groupKey || '',
          conflict.version || '',
          conflict.fileCount || '',
          conflict.files ? conflict.files.join(', ') : '',
          conflict.expectedVersion || '',
          conflict.foundVersion || ''
        ];
        rows.push(row);
      });
    });
    
    if (rows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rows.length, 10).setValues(rows);
    }
    
    // Add summary info at the top
    if (clearExisting || lastRow === 0) {
      sheet.insertRowBefore(1);
      const summaryData = [
        `Analysis Summary - ${timestamp}`,
        `Batch: ${analysis.batchInfo.startIndex}-${analysis.totalFoldersScanned}`,
        `Conflicts: ${analysis.totalConflicts}`,
        `Folders: ${analysis.foldersWithConflicts}`,
        `Duplicates: ${analysis.conflictTypes.duplicateVersions}`,
        `Missing: ${analysis.conflictTypes.missingVersions}`,
        `Invalid: ${analysis.conflictTypes.invalidVersions}`,
        '', '', ''
      ];
      sheet.getRange(1, 1, 1, summaryData.length).setValues([summaryData]);
      sheet.getRange(1, 1, 1, summaryData.length).setBackground('#f0f0f0');
    }
    
    // Auto-resize columns
    sheet.autoResizeColumns(1, 10);
    
    console.log('Results written to "Version Analysis" sheet');
    return sheet;
    
  } catch (error) {
    console.error('Error writing to sheet:', error);
    throw error;
  }
}

/**
 * Run version conflict analysis and output to sheet
 * @param {number} startIndex - Starting folder index (0-based)
 * @param {number} batchSize - Number of folders to scan in this batch
 * @param {boolean} clearExisting - Whether to clear existing sheet data
 */
function runVersionAnalysisToSheet(startIndex = 0, batchSize = 700, clearExisting = false) {
  try {
    console.log('=== VERSION CONFLICT ANALYSIS TO SHEET ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Batch settings:', `Start: ${startIndex}, Size: ${batchSize}`);
    
    const analysis = scanVersionConflicts(startIndex, batchSize);
    
    if (analysis.success === false) {
      console.error('ANALYSIS FAILED:', analysis.error);
      return;
    }
    
    // Output to sheet
    const sheet = outputAnalysisToSheet(analysis, clearExisting);
    
    // Log summary results
    console.log('\n=== ANALYSIS RESULTS ===');
    console.log('📦 Batch Info:', `Scanned ${analysis.batchInfo.scannedInBatch} folders (indexes ${analysis.batchInfo.startIndex}-${analysis.totalFoldersScanned})`);
    console.log('⚠️  Folders with Conflicts:', analysis.foldersWithConflicts);
    console.log('🔥 Total Conflicts:', analysis.totalConflicts);
    console.log('📊 Results written to sheet:', sheet.getName());
    
    if (analysis.totalConflicts === 0) {
      console.log('\n✅ NO VERSION CONFLICTS DETECTED - All clean!');
    } else {
      console.log(`\n⚠️  SUMMARY: Found ${analysis.totalConflicts} conflicts across ${analysis.foldersWithConflicts} folders`);
    }
    
    // Next batch suggestion
    const nextStart = analysis.batchInfo.startIndex + analysis.batchInfo.scannedInBatch;
    if (analysis.batchInfo.scannedInBatch === analysis.batchInfo.batchSize) {
      console.log(`\n🔄 To continue: runVersionAnalysisToSheet(${nextStart}, ${analysis.batchInfo.batchSize})`);
    }
    
    console.log('\n=== ANALYSIS COMPLETE ===');
  
  } catch (error) {
    console.error('\n=== ANALYSIS ERROR ===');
    console.error('ANALYSIS FAILED:', error.message || error.toString() || 'Unknown error occurred');
  }
}

/**
 * Run version conflict analysis from Apps Script editor
 * Outputs results to console logs only
 * @param {number} startIndex - Starting folder index (0-based)
 * @param {number} batchSize - Number of folders to scan in this batch
 */
function runVersionAnalysis(startIndex = 0, batchSize = 700) {
  try {
    console.log('=== VERSION CONFLICT ANALYSIS STARTING ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Batch settings:', `Start: ${startIndex}, Size: ${batchSize}`);
    
    const analysis = scanVersionConflicts(startIndex, batchSize);
    
    if (analysis.success === false) {
      console.error('ANALYSIS FAILED:', analysis.error);
      return;
    }
    
    // Log summary results
    console.log('\n=== ANALYSIS RESULTS ===');
    console.log('📦 Batch Info:', `Scanned ${analysis.batchInfo.scannedInBatch} folders (indexes ${analysis.batchInfo.startIndex}-${analysis.totalFoldersScanned})`);
    console.log('⚠️  Folders with Conflicts:', analysis.foldersWithConflicts);
    console.log('🔥 Total Conflicts:', analysis.totalConflicts);
    
    console.log('\n=== CONFLICT BREAKDOWN ===');
    console.log('• Duplicate Versions:', analysis.conflictTypes.duplicateVersions);
    console.log('• Missing Versions:', analysis.conflictTypes.missingVersions);
    console.log('• Invalid Versions:', analysis.conflictTypes.invalidVersions);
    
    // Log sample folders with details
    if (analysis.sampleFolders.length > 0) {
      console.log('\n=== SAMPLE FOLDERS WITH ISSUES (Max 5) ===');
      analysis.sampleFolders.forEach((folder, index) => {
        console.log(`\n${index + 1}. FOLDER: ${folder.name}`);
        console.log(`   URL: ${folder.url}`);
        console.log(`   Total Conflicts: ${folder.conflicts.length}`);
        
        folder.conflicts.forEach((conflict, cIndex) => {
          console.log(`   Conflict ${cIndex + 1}:`, JSON.stringify(conflict, null, 2));
        });
      });
    }
    
    if (analysis.totalConflicts === 0) {
      console.log('\n✅ NO VERSION CONFLICTS DETECTED - All clean!');
    } else {
      console.log(`\n⚠️  SUMMARY: Found ${analysis.totalConflicts} conflicts across ${analysis.foldersWithConflicts} folders`);
      console.log('💡 Consider running repair function to fix these issues');
    }
    
    // Next batch suggestion
    const nextStart = analysis.batchInfo.startIndex + analysis.batchInfo.scannedInBatch;
    if (analysis.batchInfo.scannedInBatch === analysis.batchInfo.batchSize) {
      console.log(`\n🔄 To continue: runVersionAnalysis(${nextStart}, ${analysis.batchInfo.batchSize})`);
    }
    
    console.log('\n=== ANALYSIS COMPLETE ===');
  
  } catch (error) {
    console.error('\n=== RUNVERSIONANALYSIS ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error toString:', error.toString());
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error('Stack trace:', error.stack);
    console.error('ANALYSIS FAILED:', error.message || error.toString() || 'Unknown error occurred');
  }
}