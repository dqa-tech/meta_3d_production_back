/**
 * Export filter builder
 * Dynamic filter creation for export operations
 */

/**
 * Get available filter options
 * @returns {Object} Available filter options
 */
function getExportFilterOptions() {
  const options = {
    batches: [],
    agents: [],
    statuses: Object.values(STATUS_VALUES),
    dateRange: {
      earliest: null,
      latest: null
    }
  };
  
  try {
    // Get unique batch IDs
    options.batches = getUniqueColumnValues('BATCH_ID')
      .filter(id => id.startsWith('IMP_')); // Only import batches
    
    // Get unique agents
    options.agents = getUniqueColumnValues('AGENT_EMAIL');
    
    // Get date range
    const tasks = queryTasks({ limit: 10000 });
    if (tasks.length > 0) {
      const dates = tasks
        .map(t => t.endTime)
        .filter(d => d)
        .map(d => new Date(d));
      
      if (dates.length > 0) {
        options.dateRange.earliest = new Date(Math.min(...dates)).toISOString();
        options.dateRange.latest = new Date(Math.max(...dates)).toISOString();
      }
    }
  } catch (error) {
    error('Failed to get filter options', { error: error.message });
  }
  
  return options;
}

/**
 * Build export filters from user input
 * @param {Object} input - User filter selections
 * @returns {Object} Processed filters
 */
function buildExportFilters(input) {
  const filters = {
    includeExported: input.includeExported || false
  };
  
  // Batch filter
  if (input.batchIds && input.batchIds.length > 0) {
    filters.batchIds = input.batchIds;
  }
  
  // Agent filter
  if (input.agentEmails && input.agentEmails.length > 0) {
    filters.agentEmails = input.agentEmails;
  }
  
  // Status filter (for export, typically only 'complete')
  if (input.statuses && input.statuses.length > 0) {
    filters.statuses = input.statuses;
  }
  
  // Date range filter
  if (input.completedAfter) {
    filters.completedAfter = input.completedAfter;
  }
  
  if (input.completedBefore) {
    filters.completedBefore = input.completedBefore;
  }
  
  // File type filters
  filters.includeFiles = {
    images: input.includeImages !== false,
    obj: input.includeObj !== false,
    alignment: input.includeAlignment !== false,
    video: input.includeVideo !== false
  };
  
  return filters;
}

/**
 * Apply filters to get exportable tasks
 * @param {Object} filters - Export filters
 * @returns {Array} Filtered tasks
 */
function applyExportFilters(filters) {
  let tasks = getTasksForExport(filters);
  
  // Apply batch filter
  if (filters.batchIds && filters.batchIds.length > 0) {
    tasks = tasks.filter(t => filters.batchIds.includes(t.batchId));
  }
  
  // Apply agent filter
  if (filters.agentEmails && filters.agentEmails.length > 0) {
    tasks = tasks.filter(t => filters.agentEmails.includes(t.agentEmail));
  }
  
  // Apply status filter
  if (filters.statuses && filters.statuses.length > 0) {
    tasks = tasks.filter(t => filters.statuses.includes(t.status));
  }
  
  return tasks;
}

/**
 * Validate export filters
 * @param {Object} filters - Filters to validate
 * @throws {ValidationError} If filters are invalid
 */
function validateExportFilters(filters) {
  // Validate date range
  if (filters.completedAfter && filters.completedBefore) {
    const after = new Date(filters.completedAfter);
    const before = new Date(filters.completedBefore);
    
    if (after > before) {
      throw new ValidationError('completedAfter cannot be later than completedBefore');
    }
  }
  
  // Validate file inclusion
  const fileTypes = filters.includeFiles || {};
  const hasAnyFiles = Object.values(fileTypes).some(v => v === true);
  
  if (!hasAnyFiles) {
    throw new ValidationError('At least one file type must be selected for export');
  }
}

/**
 * Create filter summary
 * @param {Object} filters - Applied filters
 * @param {number} resultCount - Number of matching tasks
 * @returns {Object} Filter summary
 */
function createFilterSummary(filters, resultCount) {
  const summary = {
    resultCount: resultCount,
    appliedFilters: []
  };
  
  if (filters.batchIds && filters.batchIds.length > 0) {
    summary.appliedFilters.push({
      type: 'batch',
      value: `${filters.batchIds.length} batch(es)`,
      details: filters.batchIds
    });
  }
  
  if (filters.agentEmails && filters.agentEmails.length > 0) {
    summary.appliedFilters.push({
      type: 'agent',
      value: `${filters.agentEmails.length} agent(s)`,
      details: filters.agentEmails
    });
  }
  
  if (filters.completedAfter || filters.completedBefore) {
    const dateRange = [];
    if (filters.completedAfter) {
      dateRange.push(`after ${new Date(filters.completedAfter).toLocaleDateString()}`);
    }
    if (filters.completedBefore) {
      dateRange.push(`before ${new Date(filters.completedBefore).toLocaleDateString()}`);
    }
    
    summary.appliedFilters.push({
      type: 'dateRange',
      value: dateRange.join(' and ')
    });
  }
  
  if (filters.includeExported) {
    summary.appliedFilters.push({
      type: 'includeExported',
      value: 'Including previously exported tasks'
    });
  }
  
  // File types
  const fileTypes = [];
  if (filters.includeFiles) {
    if (filters.includeFiles.images) fileTypes.push('images');
    if (filters.includeFiles.obj) fileTypes.push('3D objects');
    if (filters.includeFiles.alignment) fileTypes.push('alignments');
    if (filters.includeFiles.video) fileTypes.push('videos');
  }
  
  if (fileTypes.length > 0) {
    summary.appliedFilters.push({
      type: 'fileTypes',
      value: fileTypes.join(', ')
    });
  }
  
  return summary;
}