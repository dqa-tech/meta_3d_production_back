/**
 * Export system reporting and analytics
 * Comprehensive dashboard for monitoring export operations
 */

/**
 * Generate comprehensive export status report
 * @returns {Object} Complete system status report
 */
function generateExportStatusReport() {
  const startTime = new Date();
  
  try {
    info('Generating export status report');
    
    const report = {
      generatedAt: startTime.toISOString(),
      systemHealth: {
        score: 0,
        status: 'unknown',
        issues: []
      },
      taskSummary: {
        total: 0,
        byStatus: {},
        byExportStatus: {},
        exportable: 0,
        problematic: 0
      },
      batchSummary: {
        activeBatches: 0,
        completedBatches: 0,
        failedBatches: 0,
        batches: []
      },
      stagingInfo: {
        isConfigured: false,
        folderPath: '',
        usage: {
          folders: 0,
          estimatedSize: 'Unknown'
        }
      },
      performanceMetrics: {
        avgStagingTime: 0,
        avgDeliveryTime: 0,
        successRate: 0,
        throughput: {
          last24h: 0,
          last7d: 0,
          last30d: 0
        }
      },
      recentActivity: {
        recentStaging: [],
        recentDeliveries: [],
        recentFailures: []
      },
      recommendations: []
    };
    
    // Get overall system health
    const recoveryStatus = getRecoveryStatus();
    if (recoveryStatus.success) {
      report.systemHealth.score = recoveryStatus.recovery ? calculateHealthScore(recoveryStatus.recovery) : 100;
      report.systemHealth.status = getHealthStatus(report.systemHealth.score);
      report.systemHealth.issues = recoveryStatus.recovery?.recommendations || [];
    }
    
    // Get task summary
    const taskSummary = getExportStatusSummary();
    report.taskSummary = {
      total: taskSummary.totalTasks,
      byStatus: taskSummary.byStatus,
      byExportStatus: taskSummary.activeBatches ? 
        Object.keys(taskSummary.activeBatches).reduce((acc, batchId) => {
          const batch = taskSummary.activeBatches[batchId];
          Object.entries(batch.byStatus).forEach(([status, count]) => {
            acc[status] = (acc[status] || 0) + count;
          });
          return acc;
        }, {}) : {},
      exportable: taskSummary.exportableTasks,
      completedTasks: taskSummary.completedTasks
    };
    
    // Get batch information
    const batchInfo = getExportBatchHistory();
    report.batchSummary = batchInfo;
    
    // Get staging information
    const stagingInfo = getStagingInformation();
    report.stagingInfo = stagingInfo;
    
    // Get performance metrics
    const performanceInfo = getPerformanceMetrics();
    report.performanceMetrics = performanceInfo;
    
    // Get recent activity
    const recentActivity = getRecentActivity();
    report.recentActivity = recentActivity;
    
    // Generate recommendations
    const recommendations = generateRecommendations(report);
    report.recommendations = recommendations;
    
    const duration = new Date() - startTime;
    report.generationTime = duration;
    
    info('Export status report generated', {
      duration: duration,
      healthScore: report.systemHealth.score,
      totalTasks: report.taskSummary.total,
      activeBatches: report.batchSummary.activeBatches
    });
    
    return {
      success: true,
      report: report
    };
    
  } catch (error) {
    const duration = new Date() - startTime;
    error('Failed to generate export status report', {
      duration: duration,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message,
      generationTime: duration
    };
  }
}

/**
 * Get export batch history with detailed analytics
 * @param {number} limit - Maximum number of batches to return
 * @returns {Object} Batch history summary
 */
function getExportBatchHistory(limit = 50) {
  try {
    // Get all unique export batch IDs
    const allTasks = queryTasks({ limit: 10000 });
    const batchMap = {};
    
    allTasks.forEach(task => {
      if (task.exportBatchId) {
        if (!batchMap[task.exportBatchId]) {
          batchMap[task.exportBatchId] = {
            batchId: task.exportBatchId,
            tasks: [],
            statusCounts: {},
            createdDate: null,
            completedDate: null,
            isActive: false,
            isCompleted: false,
            hasFailed: false
          };
        }
        
        batchMap[task.exportBatchId].tasks.push(task);
        
        // Count by export status
        const exportStatus = task.exportStatus || 'no_status';
        batchMap[task.exportBatchId].statusCounts[exportStatus] = 
          (batchMap[task.exportBatchId].statusCounts[exportStatus] || 0) + 1;
        
        // Track dates
        if (task.exportTime) {
          const exportDate = new Date(task.exportTime);
          if (!batchMap[task.exportBatchId].createdDate || exportDate < new Date(batchMap[task.exportBatchId].createdDate)) {
            batchMap[task.exportBatchId].createdDate = task.exportTime;
          }
          if (!batchMap[task.exportBatchId].completedDate || exportDate > new Date(batchMap[task.exportBatchId].completedDate)) {
            batchMap[task.exportBatchId].completedDate = task.exportTime;
          }
        }
      }
    });
    
    // Analyze each batch
    Object.values(batchMap).forEach(batch => {
      const delivered = batch.statusCounts[EXPORT_STATUS_VALUES.DELIVERED] || 0;
      const staged = batch.statusCounts[EXPORT_STATUS_VALUES.STAGED] || 0;
      const staging = batch.statusCounts[EXPORT_STATUS_VALUES.STAGING] || 0;
      const delivering = batch.statusCounts[EXPORT_STATUS_VALUES.DELIVERING] || 0;
      const failed = (batch.statusCounts[EXPORT_STATUS_VALUES.STAGING_FAILED] || 0) +
                    (batch.statusCounts[EXPORT_STATUS_VALUES.DELIVERY_FAILED] || 0);
      
      batch.isCompleted = delivered === batch.tasks.length;
      batch.isActive = staging > 0 || staged > 0 || delivering > 0;
      batch.hasFailed = failed > 0;
      batch.completionRate = Math.round((delivered / batch.tasks.length) * 100);
    });
    
    const batches = Object.values(batchMap)
      .sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0))
      .slice(0, limit);
    
    const summary = {
      totalBatches: batches.length,
      activeBatches: batches.filter(b => b.isActive).length,
      completedBatches: batches.filter(b => b.isCompleted).length,
      failedBatches: batches.filter(b => b.hasFailed).length,
      batches: batches
    };
    
    return summary;
    
  } catch (error) {
    warn('Failed to get batch history', {
      error: error.message
    });
    
    return {
      totalBatches: 0,
      activeBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      batches: []
    };
  }
}

/**
 * Get active export batches currently in progress
 * @returns {Array} Active export batches
 */
function getActiveExportBatches() {
  try {
    const batchHistory = getExportBatchHistory();
    const activeBatches = batchHistory.batches.filter(batch => batch.isActive);
    
    // Enhance with progress information
    activeBatches.forEach(batch => {
      const progress = getExportBatchProgress(batch.batchId);
      batch.progress = progress.percentComplete || 0;
      batch.estimatedCompletion = progress.estimatedCompletion;
      
      // Get current stage
      if (batch.statusCounts[EXPORT_STATUS_VALUES.STAGING] > 0) {
        batch.currentStage = 'staging';
      } else if (batch.statusCounts[EXPORT_STATUS_VALUES.STAGED] > 0) {
        batch.currentStage = 'staged';
      } else if (batch.statusCounts[EXPORT_STATUS_VALUES.DELIVERING] > 0) {
        batch.currentStage = 'delivering';
      } else {
        batch.currentStage = 'mixed';
      }
    });
    
    return activeBatches;
    
  } catch (error) {
    warn('Failed to get active export batches', {
      error: error.message
    });
    return [];
  }
}

/**
 * Get failed export tasks requiring attention
 * @param {number} limit - Maximum number of tasks to return
 * @returns {Array} Failed tasks
 */
function getFailedExportTasks(limit = 100) {
  try {
    const stagingFailed = getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING_FAILED);
    const deliveryFailed = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED);
    
    const failedTasks = [...stagingFailed, ...deliveryFailed]
      .sort((a, b) => new Date(b.exportTime || 0) - new Date(a.exportTime || 0))
      .slice(0, limit);
    
    // Enhance with failure analysis
    failedTasks.forEach(task => {
      task.failureType = task.exportStatus === EXPORT_STATUS_VALUES.STAGING_FAILED ? 'staging' : 'delivery';
      task.failureAge = task.exportTime ? 
        Math.round((Date.now() - new Date(task.exportTime).getTime()) / (24 * 60 * 60 * 1000)) : 
        null;
      
      // Attempt to determine failure reason
      if (task.failureType === 'staging') {
        task.suggestedAction = 'Validate production files and retry staging';
      } else {
        task.suggestedAction = 'Check client folder permissions and retry delivery';
      }
    });
    
    return failedTasks;
    
  } catch (error) {
    warn('Failed to get failed export tasks', {
      error: error.message
    });
    return [];
  }
}

/**
 * Get staging folder usage information
 * @returns {Object} Staging folder usage data
 */
function getStagingFolderUsage() {
  try {
    const stagingConfig = getStagingConfiguration();
    
    if (!stagingConfig.isValid) {
      return {
        isConfigured: false,
        error: stagingConfig.error
      };
    }
    
    // Get staging folder contents
    const stagingSubfolders = listFolders(stagingConfig.folderId);
    const stagingFiles = listFiles(stagingConfig.folderId);
    
    // Analyze export batch folders
    const exportFolders = stagingSubfolders.filter(folder => 
      folder.name.startsWith('Export_')
    );
    
    // Calculate age distribution
    const now = new Date();
    const ageDistribution = {
      recent: 0,    // < 1 day
      week: 0,      // 1-7 days
      month: 0,     // 7-30 days
      old: 0        // > 30 days
    };
    
    exportFolders.forEach(folder => {
      try {
        // Extract date from folder name (Export_YYYY-MM-DD_BatchID)
        const dateMatch = folder.name.match(/Export_(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          const folderDate = new Date(dateMatch[1]);
          const ageInDays = (now - folderDate) / (24 * 60 * 60 * 1000);
          
          if (ageInDays < 1) ageDistribution.recent++;
          else if (ageInDays < 7) ageDistribution.week++;
          else if (ageInDays < 30) ageDistribution.month++;
          else ageDistribution.old++;
        }
      } catch (e) {
        // Skip folders with unparseable names
      }
    });
    
    return {
      isConfigured: true,
      folderId: stagingConfig.folderId,
      folderName: stagingConfig.folderName,
      folderUrl: stagingConfig.folderUrl,
      usage: {
        totalFolders: stagingSubfolders.length,
        exportFolders: exportFolders.length,
        otherFolders: stagingSubfolders.length - exportFolders.length,
        files: stagingFiles.length,
        ageDistribution: ageDistribution
      },
      recommendations: generateStagingRecommendations(ageDistribution, exportFolders.length)
    };
    
  } catch (error) {
    warn('Failed to get staging folder usage', {
      error: error.message
    });
    
    return {
      isConfigured: false,
      error: error.message
    };
  }
}

/**
 * Get staging information for report
 * @returns {Object} Staging information
 */
function getStagingInformation() {
  const stagingUsage = getStagingFolderUsage();
  
  return {
    isConfigured: stagingUsage.isConfigured,
    folderPath: stagingUsage.folderName || 'Not configured',
    folderUrl: stagingUsage.folderUrl || '',
    usage: stagingUsage.usage || {
      folders: 0,
      estimatedSize: 'Unknown'
    },
    recommendations: stagingUsage.recommendations || []
  };
}

/**
 * Get performance metrics for export operations
 * @returns {Object} Performance metrics
 */
function getPerformanceMetrics() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get completed export tasks
    const completedTasks = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERED);
    
    // Calculate throughput
    const throughput = {
      last24h: completedTasks.filter(task => 
        task.exportTime && new Date(task.exportTime) > last24h
      ).length,
      last7d: completedTasks.filter(task => 
        task.exportTime && new Date(task.exportTime) > last7d
      ).length,
      last30d: completedTasks.filter(task => 
        task.exportTime && new Date(task.exportTime) > last30d
      ).length
    };
    
    // Calculate success rate
    const allExportAttempts = [
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERED),
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING_FAILED),
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED)
    ];
    
    const successRate = allExportAttempts.length > 0 ? 
      Math.round((completedTasks.length / allExportAttempts.length) * 100) : 0;
    
    return {
      avgStagingTime: 0, // Would need staging start/end times to calculate
      avgDeliveryTime: 0, // Would need delivery start/end times to calculate
      successRate: successRate,
      throughput: throughput,
      totalDelivered: completedTasks.length,
      totalAttempts: allExportAttempts.length
    };
    
  } catch (error) {
    warn('Failed to get performance metrics', {
      error: error.message
    });
    
    return {
      avgStagingTime: 0,
      avgDeliveryTime: 0,
      successRate: 0,
      throughput: {
        last24h: 0,
        last7d: 0,
        last30d: 0
      },
      totalDelivered: 0,
      totalAttempts: 0
    };
  }
}

/**
 * Get recent export activity
 * @returns {Object} Recent activity summary
 */
function getRecentActivity() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Recent staging activity
    const recentStaging = [
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGED),
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING)
    ].filter(task => 
      task.exportTime && new Date(task.exportTime) > last24h
    ).slice(0, 10);
    
    // Recent deliveries
    const recentDeliveries = getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERED)
      .filter(task => 
        task.exportTime && new Date(task.exportTime) > last24h
      ).slice(0, 10);
    
    // Recent failures
    const recentFailures = [
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.STAGING_FAILED),
      ...getTasksByExportStatus(EXPORT_STATUS_VALUES.DELIVERY_FAILED)
    ].filter(task => 
      task.exportTime && new Date(task.exportTime) > last24h
    ).slice(0, 10);
    
    return {
      recentStaging: recentStaging,
      recentDeliveries: recentDeliveries,
      recentFailures: recentFailures
    };
    
  } catch (error) {
    warn('Failed to get recent activity', {
      error: error.message
    });
    
    return {
      recentStaging: [],
      recentDeliveries: [],
      recentFailures: []
    };
  }
}

/**
 * Generate system recommendations based on report data
 * @param {Object} report - Full system report
 * @returns {Array} Recommendations
 */
function generateRecommendations(report) {
  const recommendations = [];
  
  // Health-based recommendations
  if (report.systemHealth.score < 80) {
    recommendations.push({
      priority: 'high',
      category: 'health',
      message: 'System health is below optimal. Review failed operations.',
      action: 'Check recovery status and resolve failed tasks'
    });
  }
  
  // Staging folder recommendations
  if (report.stagingInfo.isConfigured && report.stagingInfo.usage.folders > 50) {
    recommendations.push({
      priority: 'medium',
      category: 'maintenance',
      message: 'Staging folder has many export folders. Consider cleanup.',
      action: 'Run abandoned export cleanup for old folders'
    });
  }
  
  // Performance recommendations
  if (report.performanceMetrics.successRate < 90) {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      message: `Export success rate is ${report.performanceMetrics.successRate}%. Investigate failures.`,
      action: 'Review failed tasks and common failure patterns'
    });
  }
  
  // Activity recommendations
  if (report.recentActivity.recentFailures.length > 5) {
    recommendations.push({
      priority: 'high',
      category: 'operations',
      message: 'High number of recent failures detected.',
      action: 'Investigate recent failures and retry failed operations'
    });
  }
  
  // Batch recommendations
  const stuckBatches = report.batchSummary.batches.filter(batch => 
    batch.isActive && batch.tasks.length > 0 && batch.completionRate < 50
  );
  
  if (stuckBatches.length > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'operations',
      message: `${stuckBatches.length} export batches appear stuck in progress.`,
      action: 'Review stuck batches and resume failed operations'
    });
  }
  
  return recommendations;
}

/**
 * Generate staging-specific recommendations
 * @param {Object} ageDistribution - Age distribution of export folders
 * @param {number} totalExportFolders - Total number of export folders
 * @returns {Array} Staging recommendations
 */
function generateStagingRecommendations(ageDistribution, totalExportFolders) {
  const recommendations = [];
  
  if (ageDistribution.old > 10) {
    recommendations.push('Consider cleaning up export folders older than 30 days');
  }
  
  if (totalExportFolders > 100) {
    recommendations.push('High number of export folders - recommend regular cleanup');
  }
  
  if (ageDistribution.recent === 0 && ageDistribution.week === 0) {
    recommendations.push('No recent export activity detected');
  }
  
  return recommendations;
}

/**
 * Get health status label from score
 * @param {number} score - Health score 0-100
 * @returns {string} Health status
 */
function getHealthStatus(score) {
  if (score >= 90) return 'excellent';
  if (score >= 80) return 'good';
  if (score >= 70) return 'fair';
  if (score >= 60) return 'poor';
  return 'critical';
}

/**
 * Export metrics to spreadsheet
 * @param {Object} report - System report to export
 * @returns {Object} Export result
 */
function exportMetricsToSheet(report) {
  try {
    const reportName = `Export_System_Report_${new Date().toISOString().split('T')[0]}`;
    
    // Create new spreadsheet
    const spreadsheet = SpreadsheetApp.create(reportName);
    
    // Summary sheet
    const summarySheet = spreadsheet.getActiveSheet();
    summarySheet.setName('Summary');
    
    createSummarySheet(summarySheet, report);
    
    // Batch details sheet
    const batchSheet = spreadsheet.insertSheet('Batch History');
    createBatchHistorySheet(batchSheet, report.batchSummary);
    
    // Failed tasks sheet
    const failedSheet = spreadsheet.insertSheet('Failed Tasks');
    const failedTasks = getFailedExportTasks(500);
    createFailedTasksSheet(failedSheet, failedTasks);
    
    info('Export metrics spreadsheet created', {
      reportName: reportName,
      spreadsheetId: spreadsheet.getId(),
      sheets: 3
    });
    
    return {
      success: true,
      reportName: reportName,
      spreadsheetId: spreadsheet.getId(),
      spreadsheetUrl: spreadsheet.getUrl()
    };
    
  } catch (error) {
    error('Failed to export metrics to sheet', {
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create summary sheet in report
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} report - System report
 */
function createSummarySheet(sheet, report) {
  const headers = ['Metric', 'Value', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const data = [
    ['Generated At', new Date(report.generatedAt).toLocaleString(), ''],
    ['System Health Score', report.systemHealth.score, report.systemHealth.status],
    ['Total Tasks', report.taskSummary.total, ''],
    ['Exportable Tasks', report.taskSummary.exportable, ''],
    ['Active Export Batches', report.batchSummary.activeBatches, ''],
    ['Success Rate', `${report.performanceMetrics.successRate}%`, ''],
    ['Deliveries (24h)', report.performanceMetrics.throughput.last24h, ''],
    ['Deliveries (7d)', report.performanceMetrics.throughput.last7d, ''],
    ['Staging Configured', report.stagingInfo.isConfigured ? 'Yes' : 'No', ''],
    ['Staging Folders', report.stagingInfo.usage.folders, '']
  ];
  
  sheet.getRange(2, 1, data.length, 3).setValues(data);
  
  // Format header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  sheet.autoResizeColumns(1, 3);
}

/**
 * Create batch history sheet
 * @param {Sheet} sheet - Google Sheet object
 * @param {Object} batchSummary - Batch summary data
 */
function createBatchHistorySheet(sheet, batchSummary) {
  const headers = ['Batch ID', 'Tasks', 'Completion %', 'Status', 'Created', 'Stage'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const data = batchSummary.batches.map(batch => [
    batch.batchId,
    batch.tasks.length,
    batch.completionRate,
    batch.isCompleted ? 'Complete' : batch.isActive ? 'Active' : 'Inactive',
    batch.createdDate || '',
    determineCurrentStage(batch.statusCounts)
  ]);
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  
  // Format header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Create failed tasks sheet
 * @param {Sheet} sheet - Google Sheet object
 * @param {Array} failedTasks - Failed tasks data
 */
function createFailedTasksSheet(sheet, failedTasks) {
  const headers = ['Task ID', 'Folder Name', 'Failure Type', 'Export Batch', 'Age (days)', 'Agent'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  const data = failedTasks.map(task => [
    task.taskId,
    task.folderName,
    task.failureType,
    task.exportBatchId || '',
    task.failureAge || '',
    task.agentEmail || ''
  ]);
  
  if (data.length > 0) {
    sheet.getRange(2, 1, data.length, headers.length).setValues(data);
  }
  
  // Format header
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#EA4335');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setFontWeight('bold');
  
  sheet.autoResizeColumns(1, headers.length);
}

/**
 * Determine current stage from status counts
 * @param {Object} statusCounts - Status count object
 * @returns {string} Current stage
 */
function determineCurrentStage(statusCounts) {
  if (statusCounts[EXPORT_STATUS_VALUES.DELIVERING] > 0) return 'Delivering';
  if (statusCounts[EXPORT_STATUS_VALUES.STAGED] > 0) return 'Staged';
  if (statusCounts[EXPORT_STATUS_VALUES.STAGING] > 0) return 'Staging';
  if (statusCounts[EXPORT_STATUS_VALUES.DELIVERED] > 0) return 'Delivered';
  return 'Unknown';
}