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
    .addItem('Manual Review', 'showManualReviewDialog')
    .addSeparator()
    .addSubMenu(ui.createMenu('Export')
      .addItem('Export Tasks', 'showExportWizard')
      .addItem('Stage Tasks for Export', 'showStagingWizard')
      .addItem('Reset Failed Exports', 'showResetFailedExports')
      .addItem('Export Status Report', 'showExportStatusReport'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Data Management')
      .addItem('View Statistics', 'showStatistics')
      .addItem('Validate Data', 'validateData')
      .addItem('Refresh Sheet', 'refreshSheet'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Configuration')
      .addItem('Configure Production Folder', 'configureProductionFolder')
      .addItem('Configure Staging Folder', 'configureStagingFolder')
      .addSeparator()
      .addItem('Check Schema Order', 'checkSchemaOrder')
      .addItem('Fix Schema Order', 'fixSchemaOrder'))
    .addSeparator()
    .addSubMenu(ui.createMenu('Advanced')
      .addItem('Show API Key', 'showApiKey')
      .addItem('Run Tests', 'runAllTests')
      .addItem('Clean Test Data', 'cleanupTestData'))
    .addSeparator()
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
 * Show new direct export wizard
 */
function showExportWizard() {
  const html = HtmlService.createTemplateFromFile('src/export/wizard')
    .evaluate()
    .setTitle('Export Tasks')
    .setWidth(1000)
    .setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Export Tasks');
}

/**
 * Reset failed export tasks for retry (menu handler)
 */
function showResetFailedExports() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    const result = ui.alert(
      'Reset Failed Exports',
      'This will reset all failed export tasks so they can be exported again.\n\nContinue?',
      ui.ButtonSet.YES_NO
    );
    
    if (result !== ui.Button.YES) {
      return;
    }
    
    // Call the core reset function (defined in core.js)
    const resetResult = resetFailedExports();
    
    if (resetResult.success) {
      ui.alert(
        'Reset Complete',
        `Successfully reset ${resetResult.resetCount} failed export tasks.\n\nYou can now export these tasks again.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        'Reset Failed', 
        'Failed to reset exports: ' + resetResult.error,
        ui.ButtonSet.OK
      );
    }
    
  } catch (err) {
    ui.alert(
      'Reset Error',
      'Error resetting failed exports: ' + err.message,
      ui.ButtonSet.OK
    );
  }
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
 * Show staging wizard
 */
function showStagingWizard() {
  const ui = SpreadsheetApp.getUi();
  
  // Check if staging folder is configured
  const scriptProperties = PropertiesService.getScriptProperties();
  const stagingFolderId = scriptProperties.getProperty('STAGING_FOLDER_ID');
  
  if (!stagingFolderId) {
    const result = ui.alert(
      'Staging Folder Required',
      'Please configure a staging folder first.\n\nWould you like to configure it now?',
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      configureStagingFolder();
      return;
    } else {
      return;
    }
  }
  
  const html = HtmlService.createTemplateFromFile('src/export/wizard_staging')
    .evaluate()
    .setTitle('Stage Tasks for Export')
    .setWidth(900)
    .setHeight(700);
  
  ui.showModalDialog(html, 'Stage Tasks for Export');
}

/**
 * Show delivery wizard
 */
function showDeliveryWizard() {
  const ui = SpreadsheetApp.getUi();
  
  // Check if staging folder is configured (needed for delivery)
  const scriptProperties = PropertiesService.getScriptProperties();
  const stagingFolderId = scriptProperties.getProperty('STAGING_FOLDER_ID');
  
  if (!stagingFolderId) {
    const result = ui.alert(
      'Staging Folder Required',
      'Delivery requires a configured staging folder.\n\nWould you like to configure it now?',
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      configureStagingFolder();
    }
    return;
  }
  
  // Check if there are any staged exports available
  try {
    const stagedBatches = getStagedExportBatches();
    
    if (stagedBatches.length === 0) {
      ui.alert(
        'No Staged Exports',
        'There are no staged exports available for delivery.\n\nYou need to stage tasks first using "Stage Tasks for Export".',
        ui.ButtonSet.OK
      );
      return;
    }
  } catch (error) {
    ui.alert(
      'Error',
      'Failed to check for staged exports: ' + error.message,
      ui.ButtonSet.OK
    );
    return;
  }
  
  // Show the delivery wizard
  const html = HtmlService.createTemplateFromFile('src/export/wizard_delivery')
    .evaluate()
    .setTitle('Deliver Staged Export')
    .setWidth(900)
    .setHeight(700);
  
  ui.showModalDialog(html, 'Deliver Staged Export');
}

/**
 * Show export status report
 */
function showExportStatusReport() {
  const ui = SpreadsheetApp.getUi();
  
  try {
    ui.alert('Generating Report', 'Generating export system status report. This may take a moment...', ui.ButtonSet.OK);
    
    // Generate the report
    const reportResult = generateExportStatusReport();
    
    if (!reportResult.success) {
      ui.alert(
        'Error',
        'Failed to generate export status report: ' + reportResult.error,
        ui.ButtonSet.OK
      );
      return;
    }
    
    const report = reportResult.report;
    
    // Create summary message
    let message = `Export System Status Report\n`;
    message += `Generated: ${new Date(report.generatedAt).toLocaleString()}\n\n`;
    
    message += `🏥 SYSTEM HEALTH\n`;
    message += `Health Score: ${report.systemHealth.score}/100 (${report.systemHealth.status})\n\n`;
    
    message += `📊 TASK SUMMARY\n`;
    message += `Total Tasks: ${report.taskSummary.total}\n`;
    message += `Exportable: ${report.taskSummary.exportable}\n`;
    message += `Completed: ${report.taskSummary.completedTasks}\n\n`;
    
    message += `📦 EXPORT BATCHES\n`;
    message += `Active: ${report.batchSummary.activeBatches}\n`;
    message += `Completed: ${report.batchSummary.completedBatches}\n`;
    message += `Failed: ${report.batchSummary.failedBatches}\n\n`;
    
    message += `📁 STAGING\n`;
    message += `Configured: ${report.stagingInfo.isConfigured ? 'Yes' : 'No'}\n`;
    if (report.stagingInfo.isConfigured) {
      message += `Folders: ${report.stagingInfo.usage.folders}\n`;
    }
    message += `\n`;
    
    message += `📈 PERFORMANCE\n`;
    message += `Success Rate: ${report.performanceMetrics.successRate}%\n`;
    message += `Deliveries (24h): ${report.performanceMetrics.throughput.last24h}\n`;
    message += `Deliveries (7d): ${report.performanceMetrics.throughput.last7d}\n\n`;
    
    if (report.recommendations.length > 0) {
      message += `⚠️  RECOMMENDATIONS\n`;
      report.recommendations.slice(0, 3).forEach(rec => {
        message += `• ${rec.message}\n`;
      });
      if (report.recommendations.length > 3) {
        message += `... and ${report.recommendations.length - 3} more\n`;
      }
      message += `\n`;
    }
    
    message += `Would you like to export detailed metrics to a spreadsheet?`;
    
    const result = ui.alert(
      'Export System Status Report',
      message,
      ui.ButtonSet.YES_NO
    );
    
    if (result === ui.Button.YES) {
      ui.alert('Exporting...', 'Creating detailed metrics spreadsheet...', ui.ButtonSet.OK);
      
      const exportResult = exportMetricsToSheet(report);
      
      if (exportResult.success) {
        ui.alert(
          'Export Complete',
          `Detailed report exported successfully!\n\nSpreadsheet: ${exportResult.reportName}\nURL: ${exportResult.spreadsheetUrl}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert(
          'Export Failed',
          'Failed to export detailed report: ' + exportResult.error,
          ui.ButtonSet.OK
        );
      }
    }
    
  } catch (error) {
    ui.alert(
      'Error',
      'Failed to show export status report: ' + error.message,
      ui.ButtonSet.OK
    );
  }
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

Export Tasks (Two-Phase System):
- Stage Tasks: Select and validate tasks for staging
- Deliver Staged: Review staged tasks and deliver to client
- Export Status Report: Monitor export progress and status

Legacy Single-Phase Export:
- Filter tasks by batch, status, date, or agent
- Select which files to export
- Choose destination folder in client's Drive

For more help, contact support.
  `.trim();
  
  SpreadsheetApp.getUi().alert('Help', helpText, SpreadsheetApp.getUi().ButtonSet.OK);
}