/**
 * Menu creation and management
 * Sets up the custom menu in Google Sheets
 */

/**
 * Create the custom menu
 */
function createMenu() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('3D Data Manager')
    .addItem('Import Tasks', 'showImportWizard')
    .addItem('Export Tasks', 'showExportWizard')
    .addSeparator()
    .addSubMenu(ui.createMenu('Tools')
      .addItem('Refresh Sheet', 'refreshSheet')
      .addItem('Validate Data', 'validateData')
      .addItem('View Statistics', 'showStatistics'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Advanced')
      .addItem('Show API Key', 'showApiKey')
      .addItem('Run Tests', 'runAllTests')
      .addItem('Clean Test Data', 'cleanupTestData'))
    .addSeparator()
    .addItem('Configure Production Folder', 'configureProductionFolder')
    .addItem('Settings', 'showSettings')
    .addItem('Help', 'showHelp')
    .addToUi();
}

/**
 * Show import wizard
 */
function showImportWizard() {
  const html = HtmlService.createTemplateFromFile('src/import/wizard')
    .evaluate()
    .setTitle('Import Tasks')
    .setWidth(600)
    .setHeight(500);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Import Tasks');
}

/**
 * Show export wizard
 */
function showExportWizard() {
  const html = HtmlService.createTemplateFromFile('src/export/wizard')
    .evaluate()
    .setTitle('Export Tasks')
    .setWidth(700)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Export Tasks');
}

/**
 * Refresh sheet data
 */
function refreshSheet() {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow > 1) {
    // Re-apply formatting
    applySheetFormatting(sheet);
    
    // Update any calculated fields
    updateCalculatedFields();
    
    SpreadsheetApp.getUi().alert('Sheet refreshed successfully');
  }
}

/**
 * Validate sheet data
 */
function validateData() {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('No data to validate');
    return;
  }
  
  const errors = [];
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMN_ORDER.length).getValues();
  
  data.forEach((row, index) => {
    const rowNum = index + 2;
    const taskId = row[0];
    
    if (!taskId) {
      errors.push(`Row ${rowNum}: Missing Task ID`);
    }
    
    if (!row[1]) {
      errors.push(`Row ${rowNum}: Missing Batch ID`);
    }
    
    const status = row[5];
    if (status && !Object.values(STATUS_VALUES).includes(status)) {
      errors.push(`Row ${rowNum}: Invalid status '${status}'`);
    }
  });
  
  if (errors.length > 0) {
    const ui = SpreadsheetApp.getUi();
    ui.alert('Validation Errors', errors.join('\\n'), ui.ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert('Validation passed! No errors found.');
  }
}

/**
 * Show statistics
 */
function showStatistics() {
  const sheet = getTasksSheet();
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('No data available');
    return;
  }
  
  const data = sheet.getRange(2, 1, lastRow - 1, COLUMN_ORDER.length).getValues();
  const stats = calculateStatistics(data);
  
  const message = `
Total Tasks: ${stats.total}
Open: ${stats.open}
In Progress: ${stats.inProgress}
Complete: ${stats.complete}
Flagged: ${stats.flagged}

Unique Batches: ${stats.uniqueBatches}
Unique Agents: ${stats.uniqueAgents}
  `.trim();
  
  SpreadsheetApp.getUi().alert('Task Statistics', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Calculate statistics from data
 */
function calculateStatistics(data) {
  const stats = {
    total: data.length,
    open: 0,
    inProgress: 0,
    complete: 0,
    flagged: 0,
    uniqueBatches: new Set(),
    uniqueAgents: new Set()
  };
  
  data.forEach(row => {
    const status = row[5];
    const batchId = row[1];
    const agent = row[6];
    
    if (status === STATUS_VALUES.OPEN) stats.open++;
    else if (status === STATUS_VALUES.IN_PROGRESS) stats.inProgress++;
    else if (status === STATUS_VALUES.COMPLETE) stats.complete++;
    else if (status === STATUS_VALUES.FLAGGED) stats.flagged++;
    
    if (batchId) stats.uniqueBatches.add(batchId);
    if (agent) stats.uniqueAgents.add(agent);
  });
  
  stats.uniqueBatches = stats.uniqueBatches.size;
  stats.uniqueAgents = stats.uniqueAgents.size;
  
  return stats;
}

/**
 * Update calculated fields
 */
function updateCalculatedFields() {
  // Placeholder for any calculated fields that need updating
  // This could include duration calculations, completion rates, etc.
}

/**
 * Show settings dialog
 */
function showSettings() {
  showCurrentSettings();
}

/**
 * Show help dialog
 */
function showHelp() {
  const helpText = `
3D Data Management System Help

Import Tasks:
- Select a Drive folder containing task folders
- Each task folder should contain image.jpg, img_mask.jpg, and mask.jpg
- Tasks will be copied to the production folder

Export Tasks:
- Filter tasks by batch, status, date, or agent
- Select which files to export
- Choose destination folder in client's Drive

For more help, contact support.
  `.trim();
  
  SpreadsheetApp.getUi().alert('Help', helpText, SpreadsheetApp.getUi().ButtonSet.OK);
}