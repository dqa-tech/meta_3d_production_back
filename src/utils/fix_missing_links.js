/**
 * Fix Missing Image Links Utility
 * Repairs missing image, mask, and img_mask links in the sheet by scanning production folders
 */

/**
 * Fix missing image links in the sheet
 * @param {boolean} dryRun - If true, only shows what would be fixed without making changes
 * @returns {Object} Summary of fixes applied
 */
function fixMissingImageLinks(dryRun = false) {
  console.log(`${dryRun ? '🧪 DRY RUN: ' : '🔧 '}Starting missing image links fix...`);
  
  try {
    const sheet = getTasksSheet();
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('No data rows found in sheet');
      return { fixed: 0, errors: 0, skipped: 0 };
    }
    
    // Get column indices
    const columns = {
      TASK_ID: getColumnIndex('TASK_ID') - 1,
      PRODUCTION_FOLDER_LINK: getColumnIndex('PRODUCTION_FOLDER_LINK') - 1,
      IMAGE_LINK: getColumnIndex('IMAGE_LINK') - 1,
      IMG_MASK_LINK: getColumnIndex('IMG_MASK_LINK') - 1,
      MASK_LINK: getColumnIndex('MASK_LINK') - 1
    };
    
    const results = {
      processed: 0,
      fixed: 0,
      skipped: 0,
      errors: 0,
      details: []
    };
    
    // Process each data row (skip header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 1;
      const taskId = row[columns.TASK_ID];
      const productionFolderLink = row[columns.PRODUCTION_FOLDER_LINK];
      
      // Skip rows without task ID or production folder
      if (!taskId || !productionFolderLink) {
        results.skipped++;
        continue;
      }
      
      // Check which links are missing
      const missingLinks = [];
      if (!row[columns.IMAGE_LINK]) missingLinks.push('IMAGE_LINK');
      if (!row[columns.IMG_MASK_LINK]) missingLinks.push('IMG_MASK_LINK');
      if (!row[columns.MASK_LINK]) missingLinks.push('MASK_LINK');
      
      // Skip if all links are present
      if (missingLinks.length === 0) {
        results.skipped++;
        continue;
      }
      
      results.processed++;
      
      try {
        // Extract folder ID from production folder link
        const folderId = extractFolderIdFromUrl(productionFolderLink);
        if (!folderId) {
          console.log(`⚠️ Row ${rowNum} (${taskId}): Invalid production folder URL`);
          results.errors++;
          continue;
        }
        
        // Find missing files in the folder
        const foundLinks = findImageFilesInFolder(folderId);
        
        // Update the row with found links
        const updates = {};
        let hasUpdates = false;
        
        if (missingLinks.includes('IMAGE_LINK') && foundLinks['image.jpg']) {
          updates.IMAGE_LINK = foundLinks['image.jpg'];
          hasUpdates = true;
        }
        if (missingLinks.includes('IMG_MASK_LINK') && foundLinks['img_mask.jpg']) {
          updates.IMG_MASK_LINK = foundLinks['img_mask.jpg'];
          hasUpdates = true;
        }
        if (missingLinks.includes('MASK_LINK') && foundLinks['mask.jpg']) {
          updates.MASK_LINK = foundLinks['mask.jpg'];
          hasUpdates = true;
        }
        
        if (hasUpdates) {
          if (!dryRun) {
            // Apply updates to sheet
            Object.entries(updates).forEach(([linkType, url]) => {
              const colIndex = columns[linkType];
              sheet.getRange(rowNum, colIndex + 1).setValue(url);
            });
          }
          
          const fixedLinks = Object.keys(updates);
          console.log(`${dryRun ? '🔍' : '✅'} Row ${rowNum} (${taskId}): Fixed ${fixedLinks.join(', ')}`);
          results.fixed++;
          results.details.push({
            taskId: taskId,
            rowNum: rowNum,
            fixedLinks: fixedLinks,
            updates: updates
          });
        } else {
          console.log(`⚠️ Row ${rowNum} (${taskId}): Required files not found in folder`);
          results.errors++;
        }
        
      } catch (error) {
        console.log(`❌ Row ${rowNum} (${taskId}): Error - ${error.message}`);
        results.errors++;
      }
    }
    
    // Summary
    console.log(`\n📊 Summary:`);
    console.log(`   Processed: ${results.processed} rows`);
    console.log(`   Fixed: ${results.fixed} rows`);
    console.log(`   Skipped: ${results.skipped} rows`);
    console.log(`   Errors: ${results.errors} rows`);
    
    if (dryRun && results.fixed > 0) {
      console.log(`\n💡 Run fixMissingImageLinks() without parameters to apply these fixes`);
    }
    
    return results;
    
  } catch (error) {
    console.log(`❌ Failed to fix missing links: ${error.message}`);
    throw error;
  }
}

/**
 * Extract folder ID from Google Drive URL
 * @param {string} url - Drive folder URL
 * @returns {string|null} Folder ID or null if invalid
 */
function extractFolderIdFromUrl(url) {
  if (!url) return null;
  
  // Handle different URL formats
  const patterns = [
    /\/folders\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]+)$/ // Direct ID
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Find image files in a production folder
 * @param {string} folderId - Production folder ID
 * @returns {Object} Object mapping file names to their URLs
 */
function findImageFilesInFolder(folderId) {
  const requiredFiles = ['image.jpg', 'img_mask.jpg', 'mask.jpg'];
  const foundFiles = {};
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    
    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName().toLowerCase();
      
      if (requiredFiles.includes(fileName)) {
        foundFiles[fileName] = file.getUrl();
      }
    }
    
  } catch (error) {
    throw new Error(`Cannot access folder ${folderId}: ${error.message}`);
  }
  
  return foundFiles;
}

/**
 * Quick test function to check a specific task
 * @param {string} taskId - Task ID to test
 */
function testMissingLinksForTask(taskId) {
  console.log(`🧪 Testing missing links fix for task: ${taskId}`);
  
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  const taskIdCol = getColumnIndex('TASK_ID') - 1;
  
  // Find the task row
  for (let i = 1; i < data.length; i++) {
    if (data[i][taskIdCol] === taskId) {
      const row = data[i];
      const productionFolderLink = row[getColumnIndex('PRODUCTION_FOLDER_LINK') - 1];
      
      console.log(`Production folder: ${productionFolderLink}`);
      
      const folderId = extractFolderIdFromUrl(productionFolderLink);
      console.log(`Extracted folder ID: ${folderId}`);
      
      if (folderId) {
        const foundFiles = findImageFilesInFolder(folderId);
        console.log(`Found files:`, foundFiles);
      }
      
      return;
    }
  }
  
  console.log(`Task ${taskId} not found`);
}