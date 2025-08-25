/**
 * Manual Review Handler
 * Provides Google Sheets UI for manual task review with override capabilities
 */

/**
 * Show manual review dialog
 */
function showManualReviewDialog() {
  const html = HtmlService.createTemplateFromFile('src/ui/manual_review')
    .evaluate()
    .setTitle('Manual Review')
    .setWidth(700)
    .setHeight(600);
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Manual Review');
}

/**
 * Process manual review for multiple tasks
 * @param {string} taskIdsText - Newline-separated task IDs
 * @param {string} reviewStatus - 'pending', 'passed', or 'failed'
 * @param {number} reviewScore - Review score (0-100)
 * @param {boolean} overrideMode - Allow status changes regardless of current state
 * @returns {Object} Results object with summary and individual results
 */
function processManualReview(taskIdsText, reviewStatus, reviewScore, overrideMode) {
  try {
    // Parse task IDs
    const taskIds = taskIdsText
      .split('\n')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    if (taskIds.length === 0) {
      throw new Error('No valid task IDs provided');
    }
    
    // Get reviewer email from session
    const reviewerEmail = Session.getActiveUser().getEmail();
    
    if (!reviewerEmail) {
      throw new Error('Unable to determine reviewer email');
    }
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Process each task
    for (const taskId of taskIds) {
      try {
        const result = applyManualReview(taskId, reviewStatus, reviewScore, reviewerEmail, overrideMode);
        results.push({
          taskId: taskId,
          success: true,
          action: result.action
        });
        successful++;
      } catch (error) {
        results.push({
          taskId: taskId,
          success: false,
          error: error.message
        });
        failed++;
      }
    }
    
    return {
      success: true,
      results: results,
      summary: {
        total: taskIds.length,
        successful: successful,
        failed: failed
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Apply manual review to a single task
 * @param {string} taskId - Task ID to review
 * @param {string} reviewStatus - 'pending', 'passed', or 'failed'
 * @param {number} reviewScore - Review score (0-100)
 * @param {string} reviewerEmail - Email of reviewer
 * @param {boolean} overrideMode - Allow status changes regardless of current state
 * @returns {Object} Result with action description
 */
function applyManualReview(taskId, reviewStatus, reviewScore, reviewerEmail, overrideMode) {
  // Get current task state
  const currentTask = getTaskById(taskId);
  
  if (!currentTask) {
    throw new Error('Task not found');
  }
  
  // Validation for normal mode
  if (!overrideMode) {
    if (currentTask.status !== STATUS_VALUES.COMPLETE) {
      throw new Error(`Task status is '${currentTask.status}', expected 'complete'`);
    }
    
    if (currentTask.reviewStatus && currentTask.reviewStatus !== REVIEW_STATUS_VALUES.PENDING) {
      throw new Error(`Task already reviewed (status: ${currentTask.reviewStatus})`);
    }
  }
  
  const reviewTime = new Date().toISOString();
  let updates = {};
  let action = '';
  
  // Handle different review status transitions
  switch (reviewStatus) {
    case REVIEW_STATUS_VALUES.PASSED:
      updates = handlePassedReview(currentTask, reviewScore, reviewerEmail, reviewTime);
      action = determinePassedAction(currentTask);
      break;
      
    case REVIEW_STATUS_VALUES.FAILED:
      updates = handleFailedReview(currentTask, reviewScore, reviewerEmail, reviewTime);
      action = determineFailedAction(currentTask);
      break;
      
    case REVIEW_STATUS_VALUES.PENDING:
      updates = handlePendingReview(currentTask);
      action = 'Reset to pending for re-review';
      break;
      
    default:
      throw new Error(`Invalid review status: ${reviewStatus}`);
  }
  
  // Apply updates
  updateTaskRecord(taskId, updates);
  
  return { action: action };
}

/**
 * Handle passed review logic
 */
function handlePassedReview(currentTask, reviewScore, reviewerEmail, reviewTime) {
  const updates = {
    reviewStatus: REVIEW_STATUS_VALUES.PASSED,
    reviewScore: reviewScore,
    reviewerEmail: reviewerEmail,
    reviewTime: reviewTime
  };
  
  // If task is in rework, restore it to complete with artifacts from revision history
  if (currentTask.status === STATUS_VALUES.REWORK && currentTask.revisionHistory) {
    try {
      const history = JSON.parse(currentTask.revisionHistory);
      const lastRevision = history[history.length - 1];
      
      if (lastRevision) {
        updates.status = STATUS_VALUES.COMPLETE;
        updates.objLink = lastRevision.objLink || '';
        updates.alignmentLink = lastRevision.alignmentLink || '';
        updates.videoLink = lastRevision.videoLink || '';
        updates.timeTaken = lastRevision.timeTaken || '';
        updates.endTime = lastRevision.completedAt || '';
      }
    } catch (e) {
      // If revision history is malformed, just update review status
      warn('Failed to parse revision history for task restoration', { taskId: currentTask.taskId, error: e.message });
    }
  }
  
  return updates;
}

/**
 * Handle failed review logic
 */
function handleFailedReview(currentTask, reviewScore, reviewerEmail, reviewTime) {
  // If task is currently passed, need to trigger rework
  if (currentTask.reviewStatus === REVIEW_STATUS_VALUES.PASSED || 
      currentTask.status === STATUS_VALUES.COMPLETE) {
    
    // Build revision history entry
    const revisionEntry = {
      revision: (currentTask.revisionCount || 0) + 1,
      agentEmail: currentTask.agentEmail,
      completedAt: currentTask.endTime,
      startedAt: currentTask.startTime,
      objLink: currentTask.objLink || '',
      alignmentLink: currentTask.alignmentLink || '',
      videoLink: currentTask.videoLink || '',
      timeTaken: currentTask.timeTaken || '',
      reviewScore: reviewScore,
      reviewedBy: reviewerEmail,
      reviewedAt: reviewTime,
      reason: `Manual review override: Changed to failed`
    };
    
    // Parse existing history or create new array
    let revisionHistory = [];
    if (currentTask.revisionHistory) {
      try {
        revisionHistory = JSON.parse(currentTask.revisionHistory);
      } catch (e) {
        revisionHistory = [];
      }
    }
    revisionHistory.push(revisionEntry);
    
    // Determine rework assignee based on revision count
    const isFirstRework = !currentTask.revisionCount || currentTask.revisionCount === '';
    const reworkAssignee = isFirstRework ? currentTask.agentEmail : reviewerEmail;
    
    const updates = {
      status: STATUS_VALUES.REWORK,
      revisionCount: (currentTask.revisionCount || 0) + 1,
      revisionHistory: JSON.stringify(revisionHistory),
      previousAgentEmail: currentTask.agentEmail,
      agentEmail: reworkAssignee,
      startTime: reviewTime,
      // Clear completion data
      endTime: '',
      objLink: '',
      alignmentLink: '',
      videoLink: '',
      // Set review data
      reviewStatus: REVIEW_STATUS_VALUES.FAILED,
      reviewScore: reviewScore,
      reviewerEmail: reviewerEmail,
      reviewTime: reviewTime
    };
    
    // Store original completion time if this is first rework
    if (isFirstRework && currentTask.endTime) {
      updates.originalCompletionTime = currentTask.endTime;
    }
    
    return updates;
  } else {
    // Just update review status for tasks not currently passed
    return {
      reviewStatus: REVIEW_STATUS_VALUES.FAILED,
      reviewScore: reviewScore,
      reviewerEmail: reviewerEmail,
      reviewTime: reviewTime
    };
  }
}

/**
 * Handle pending review logic
 */
function handlePendingReview(currentTask) {
  // Reset review fields while keeping task status as complete if it has artifacts
  const updates = {
    reviewStatus: REVIEW_STATUS_VALUES.PENDING,
    reviewScore: null,
    reviewerEmail: null,
    reviewTime: null
  };
  
  // If task is in rework, we may want to restore it to complete
  if (currentTask.status === STATUS_VALUES.REWORK && 
      (currentTask.objLink || currentTask.alignmentLink || currentTask.videoLink)) {
    updates.status = STATUS_VALUES.COMPLETE;
  }
  
  return updates;
}

/**
 * Determine action description for passed review
 */
function determinePassedAction(currentTask) {
  if (currentTask.status === STATUS_VALUES.REWORK) {
    return 'Changed from failed to passed (restored from revision history)';
  } else if (currentTask.reviewStatus === REVIEW_STATUS_VALUES.FAILED) {
    return 'Changed from failed to passed';
  } else if (currentTask.reviewStatus === REVIEW_STATUS_VALUES.PENDING) {
    return 'Marked as passed';
  } else {
    return 'Review status updated to passed';
  }
}

/**
 * Determine action description for failed review
 */
function determineFailedAction(currentTask) {
  if (currentTask.reviewStatus === REVIEW_STATUS_VALUES.PASSED) {
    const isFirstRework = !currentTask.revisionCount || currentTask.revisionCount === '';
    const assignee = isFirstRework ? 'original agent' : 'reviewer';
    return `Changed from passed to failed (sent to rework, assigned to ${assignee})`;
  } else if (currentTask.reviewStatus === REVIEW_STATUS_VALUES.PENDING) {
    return 'Marked as failed (sent to rework)';
  } else {
    return 'Review status updated to failed';
  }
}