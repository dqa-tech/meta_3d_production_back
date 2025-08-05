/**
 * Export task selector
 * Selects and prepares tasks for export
 */

/**
 * Select tasks for export
 * @param {Object} filters - Export filters
 * @returns {Object} Selection results
 */
function selectTasksForExport(filters) {
  // Validate filters
  validateExportFilters(filters);
  
  // Apply filters to get tasks
  const tasks = applyExportFilters(filters);
  
  // Group tasks by folder for efficient export
  const tasksByFolder = groupTasksByFolder(tasks);
  
  // Calculate export size estimate
  const sizeEstimate = estimateExportSize(tasks, filters.includeFiles);
  
  // Create selection summary
  const summary = {
    totalTasks: tasks.length,
    tasksByFolder: tasksByFolder,
    sizeEstimate: sizeEstimate,
    filters: createFilterSummary(filters, tasks.length),
    tasks: tasks
  };
  
  info('Tasks selected for export', {
    count: tasks.length,
    folders: Object.keys(tasksByFolder).length
  });
  
  return summary;
}

/**
 * Group tasks by production folder
 * @param {Array} tasks - Tasks to group
 * @returns {Object} Tasks grouped by folder
 */
function groupTasksByFolder(tasks) {
  const groups = {};
  
  tasks.forEach(task => {
    const folderName = task.folderName;
    if (!groups[folderName]) {
      groups[folderName] = [];
    }
    groups[folderName].push(task);
  });
  
  return groups;
}

/**
 * Estimate export size
 * @param {Array} tasks - Tasks to export
 * @param {Object} includeFiles - Which files to include
 * @returns {Object} Size estimate
 */
function estimateExportSize(tasks, includeFiles) {
  const estimate = {
    totalFiles: 0,
    estimatedSize: 0,
    breakdown: {
      images: { count: 0, size: 0 },
      obj: { count: 0, size: 0 },
      alignment: { count: 0, size: 0 },
      video: { count: 0, size: 0 }
    }
  };
  
  // Average file sizes (in MB)
  const avgSizes = {
    image: 2,
    obj: 5,
    alignment: 1,
    video: 50
  };
  
  tasks.forEach(task => {
    if (includeFiles.images) {
      estimate.breakdown.images.count += 3; // image, img_mask, mask
      estimate.breakdown.images.size += avgSizes.image * 3;
      estimate.totalFiles += 3;
    }
    
    if (includeFiles.obj && task.objLink) {
      estimate.breakdown.obj.count += 1;
      estimate.breakdown.obj.size += avgSizes.obj;
      estimate.totalFiles += 1;
    }
    
    if (includeFiles.alignment && task.alignmentLink) {
      estimate.breakdown.alignment.count += 1;
      estimate.breakdown.alignment.size += avgSizes.alignment;
      estimate.totalFiles += 1;
    }
    
    if (includeFiles.video && task.videoLink) {
      estimate.breakdown.video.count += 1;
      estimate.breakdown.video.size += avgSizes.video;
      estimate.totalFiles += 1;
    }
  });
  
  // Calculate total size
  Object.values(estimate.breakdown).forEach(category => {
    estimate.estimatedSize += category.size;
  });
  
  // Format size
  estimate.formattedSize = formatFileSize(estimate.estimatedSize * 1024 * 1024);
  
  return estimate;
}

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Prepare export manifest
 * @param {Object} selection - Task selection
 * @param {string} exportBatchId - Export batch ID
 * @returns {Object} Export manifest
 */
function prepareExportManifest(selection, exportBatchId) {
  const manifest = {
    exportBatchId: exportBatchId,
    createdAt: new Date().toISOString(),
    createdBy: getCurrentUser().email,
    summary: {
      totalTasks: selection.totalTasks,
      totalFiles: selection.sizeEstimate.totalFiles,
      estimatedSize: selection.sizeEstimate.formattedSize
    },
    filters: selection.filters,
    tasks: []
  };
  
  // Add task details
  selection.tasks.forEach(task => {
    manifest.tasks.push({
      taskId: task.taskId,
      folderName: task.folderName,
      files: getTaskExportFiles(task, selection.filters.includeFiles)
    });
  });
  
  return manifest;
}

/**
 * Get files to export for a task
 * @param {Object} task - Task object
 * @param {Object} includeFiles - Which files to include
 * @returns {Array} Files to export
 */
function getTaskExportFiles(task, includeFiles) {
  const files = [];
  
  if (includeFiles.images) {
    if (task.imageLink) {
      files.push({
        name: 'image.jpg',
        url: task.imageLink,
        type: 'image'
      });
    }
    if (task.imgMaskLink) {
      files.push({
        name: 'img_mask.jpg',
        url: task.imgMaskLink,
        type: 'image'
      });
    }
    if (task.maskLink) {
      files.push({
        name: 'mask.jpg',
        url: task.maskLink,
        type: 'image'
      });
    }
  }
  
  if (includeFiles.obj && task.objLink) {
    files.push({
      name: `${task.folderName}.obj`,
      url: task.objLink,
      type: 'obj'
    });
  }
  
  if (includeFiles.alignment && task.alignmentLink) {
    files.push({
      name: `${task.folderName}_alignment.jpg`,
      url: task.alignmentLink,
      type: 'alignment'
    });
  }
  
  if (includeFiles.video && task.videoLink) {
    files.push({
      name: `${task.folderName}_recording.mp4`,
      url: task.videoLink,
      type: 'video'
    });
  }
  
  return files;
}