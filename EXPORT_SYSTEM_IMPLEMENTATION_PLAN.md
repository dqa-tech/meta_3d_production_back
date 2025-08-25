# Two-Phase Export System - Implementation Plan

## Overview
Transform the current single-phase export into a robust two-phase system: **Staging** → **Delivery**. This creates a quality control gate, reduces execution risk, and enables operational review before client delivery.

## Architecture Summary

```
Phase 1: STAGING WIZARD
Tasks → Filter → Validate → Copy to Staging → Create Export Sheet → Mark "staged"

Phase 2: DELIVERY WIZARD  
Staged Folder → Review → Select Client Target → Copy to Client → Mark "delivered"
```

## Implementation Phases

### PHASE 1: Schema & Configuration Updates

#### 1.1 Schema Updates (`src/sheet/schema.js`)

**Add New Columns:**
```javascript
// In COLUMNS object:
EXPORT_STATUS: 'Export Status'
STAGED_COUNT: 'Staged Count'

// In COLUMN_ORDER array (after EXPORT_BATCH_ID):
'EXPORT_STATUS'
'STAGED_COUNT'

// New status values:
const EXPORT_STATUS_VALUES = {
  null: null,
  STAGING: 'staging',
  STAGED: 'staged', 
  DELIVERING: 'delivering',
  DELIVERED: 'delivered',
  STAGING_FAILED: 'staging_failed',
  DELIVERY_FAILED: 'delivery_failed'
}
```

#### 1.2 Configuration Management

**New Settings Function (`src/ui/settings.js`):**
```pseudocode
function configureStagingFolder()
  - Show folder picker dialog
  - Validate user has write access to selected folder
  - Save STAGING_FOLDER_ID to PropertiesService.getScriptProperties()
  - Display confirmation with folder name
```

**Menu Integration (`src/ui/menu.js`):**
```pseudocode
Add to Tools submenu:
  - "Configure Staging Folder" → configureStagingFolder()
  - "Stage Tasks for Export" → showStagingWizard()
  - "Deliver Staged Export" → showDeliveryWizard()
  - "Export Status Report" → showExportStatusReport()
```

### PHASE 2: Staging System Implementation

#### 2.1 Staging Query Logic (`src/sheet/queries.js`)

**Update getTasksForExport():**
```pseudocode
function getTasksForExport(filters)
  - Default criteria: status = 'complete' AND reviewStatus = 'passed' AND exportStatus IS NULL
  - Apply existing filters (batch, agent, dates)
  - Add new filters: reviewStatus, reviewScore range, reviewer
  - Override options: includeUnreviewed, includeFailed, includeAlreadyExported
  - Return filtered tasks ready for staging
```

**New Query Function:**
```pseudocode
function getStagedExportBatches()
  - Query tasks where exportStatus = 'staged'
  - Group by exportBatchId
  - Return summary: {batchId, taskCount, createdDate, stagingFolderPath}
```

#### 2.2 Staging Operations (`src/export/staging.js` - NEW FILE)

**Core Staging Function:**
```pseudocode
function executeStagingOperation(taskSelection, exportBatchId)
  1. Validate staging folder exists and accessible
  2. PRE-STAGING VALIDATION: For each task, validate:
     - At least 1 .obj file containing folderName
     - At least 1 .jpg file containing folderName (excluding base images)
     - At least 1 .mp4 file containing folderName
     - Total file count ≥ 6 (3 base + 3 production minimum)
  3. Mark valid tasks: exportStatus = 'staging', exportBatchId = batchId
  4. Mark invalid tasks: exportStatus = 'staging_failed' with validation errors
  5. Create batch folder in staging: "Export_YYYY-MM-DD_[batchId]"
  6. Process valid tasks in chunks of 5:
     - Create task folder in staging batch folder
     - Copy all task files (images, obj, alignment, video)
     - Count files copied during operation
     - On success: mark as 'staged', set stagedCount = file count
     - On failure: mark task as 'staging_failed', continue with others
  7. Create export sheet with ALL columns for staged tasks
  8. Place export sheet in staging batch folder
  9. Return summary: successful count, failed count, validation failures, staging folder link
```

**Staging Support Functions:**
```pseudocode
function validateProductionFiles(task)
  - Check task files contain folderName and include one of each: .obj, .jpg, .mp4
  - Ensure total file count ≥ 6
  - Return: {isValid, missingTypes, fileCount, errors}

function stageTaskFiles(task, stagingBatchFolder)
  - Create task subfolder: task.folderName
  - Copy files using extractFileIdFromUrl() and copyFile()
  - Count files during copy operation
  - Return: {success, fileCount, errors}

function createStagingExportSheet(tasks, stagingFolder)
  - Create new Google Sheet: "Export_[batchId]_Data"  
  - Write headers: ALL columns from COLUMN_ORDER
  - Write task data: ALL columns for all staged tasks
  - Move sheet file to staging folder
  - Return sheet ID and URL
```

#### 2.3 Staging Wizard UI (`src/export/wizard_staging.html` - NEW FILE)

**4-Step Wizard Structure:**
```html
Step 1: Configure Filters
  - All existing filters (batch, agent, date range)
  - NEW: Review Status filter (All, Passed, Failed, Pending)
  - NEW: Review Score range (min/max sliders)
  - NEW: Reviewer filter (multiselect)
  - NEW: Override section with warnings

Step 2: Preview Staging
  - Show selected tasks count and details
  - Show staging destination folder path
  - Show size estimates
  - Preview export sheet contents

Step 3: Execute Staging
  - Progress bar: "Staging X of Y tasks..."
  - File-level progress indicator
  - Real-time success/failure counts

Step 4: Staging Complete
  - Summary: X staged, Y failed
  - Link to staging folder
  - Link to export sheet
  - Option to proceed to delivery wizard
```

#### 2.4 Staging Wizard Handlers (`src/export/stagingHandlers.js` - NEW FILE)

**Server-Side Functions:**
```pseudocode
function getTasksForStaging(filters)
  - Call updated getTasksForExport() with filters
  - Return task selection with size estimates

function executeStagingWizard(selection, exportBatchId)
  - Call executeStagingOperation()
  - Return results for UI display

function getStagingConfiguration()
  - Get STAGING_FOLDER_ID from properties
  - Validate folder still exists and accessible
  - Return staging folder info
```

### PHASE 3: Delivery System Implementation

#### 3.1 Delivery Operations (`src/export/delivery.js` - NEW FILE)

**Core Delivery Function:**
```pseudocode
function executeDeliveryOperation(exportBatchId, clientFolderId)
  1. Get tasks where exportBatchId = batchId AND exportStatus = 'staged'
  2. Mark tasks: exportStatus = 'delivering'
  3. Get staging batch folder for this export
  4. Create delivery folder structure in client destination
  5. Copy all task folders from staging to client (EXCLUDE export sheet)
  6. POST-DELIVERY VALIDATION: For each task folder:
     - Count files in client destination
     - Verify count matches task.stagedCount
     - On mismatch: mark as 'delivery_failed'
     - On success: mark as 'delivered'
  7. Return delivery summary with validation results
```

**Delivery Support Functions:**
```pseudocode
function copyTaskFoldersToClient(stagingFolder, clientFolder, excludeSheets)
  - List all subfolders in staging (these are task folders)
  - Copy each task folder to client destination
  - Skip .gsheet files (export sheet stays internal)
  - Return copy results with file counts

function validateDeliveredTask(task, clientTaskFolder)
  - Count files in delivered task folder
  - Compare with task.stagedCount
  - Return: {isValid, expectedCount, actualCount, errors}
```

#### 3.2 Delivery Wizard UI (`src/export/wizard_delivery.html` - NEW FILE)

**5-Step Wizard Structure:**
```html
Step 1: Select Staged Export
  - Dropdown of available staged exports
  - Show: batch ID, task count, created date
  - Preview staging folder contents

Step 2: Review Export Contents
  - Display staging folder structure
  - Show export sheet preview
  - Highlight what goes to client vs. stays internal

Step 3: Select Client Destination
  - Client folder picker
  - Validate write permissions
  - Show client folder path

Step 4: Execute Delivery
  - Progress bar: "Delivering X of Y tasks..."
  - Folder-level progress indicator

Step 5: Delivery Complete
  - Summary: X delivered successfully
  - Link to client delivery folder
  - Final confirmation
```

#### 3.3 Delivery Wizard Handlers (`src/export/deliveryHandlers.js` - NEW FILE)

**Server-Side Functions:**
```pseudocode
function getAvailableStagedExports()
  - Call getStagedExportBatches()
  - Enhance with staging folder details
  - Return list for UI dropdown

function previewStagedExport(exportBatchId)
  - Get staging folder contents
  - Get export sheet preview
  - Return structured preview data

function executeDeliveryWizard(exportBatchId, clientFolderId)
  - Call executeDeliveryOperation()
  - Return results for UI display
```

### PHASE 4: Error Handling & Recovery

#### 4.1 Status Management (`src/export/status.js` - NEW FILE)

**Status Update Functions:**
```pseudocode
function updateTaskExportStatus(taskIds, status, exportBatchId = null)
  - Update exportStatus for given tasks
  - Optionally set exportBatchId
  - Log status change with timestamp

function getTasksByExportStatus(status, exportBatchId = null)
  - Query tasks by export status
  - Optionally filter by export batch
  - Return matching tasks

function resetTaskExportStatus(taskId, newStatus, reason)
  - Manual override for ops team
  - Log reason for status change
  - Update task record
```

#### 4.2 Recovery Functions (`src/export/recovery.js` - NEW FILE)

**Staging Recovery:**
```pseudocode
function resumeFailedStaging(exportBatchId)
  - Find tasks with exportStatus = 'staging'
  - Re-attempt staging for these tasks
  - Update status based on results

function retryFailedStagingTasks(exportBatchId)
  - Find tasks with exportStatus = 'staging_failed'
  - Allow manual retry of staging operation
  - Reset to 'staging' and re-attempt
```

**Delivery Recovery:**
```pseudocode
function resumeFailedDelivery(exportBatchId)
  - Find tasks with exportStatus = 'delivering'
  - Re-attempt delivery for these tasks
  - Update status based on results

function retryFailedDelivery(exportBatchId, clientFolderId)
  - Find tasks with exportStatus = 'delivery_failed'
  - Allow manual retry of delivery operation
  - Reset to 'staged' and re-attempt
```

### PHASE 5: Enhanced Filtering & UI Updates

#### 5.1 Filter Updates (`src/export/filters.js`)

**Enhanced Filter Options:**
```pseudocode
Add to getExportFilterOptions():
  - reviewStatuses: ['passed', 'failed', 'pending']
  - reviewers: [list of unique reviewer emails]
  - reviewScoreRange: {min: 0, max: 100}
  - exportStatuses: [list of export status values]

Update buildExportFilters():
  - Add reviewStatus filter array
  - Add reviewScoreMin, reviewScoreMax
  - Add reviewerEmails array
  - Add override flags: includeUnreviewed, includeFailed
```

#### 5.2 Query Updates (`src/sheet/queries.js`)

**Enhanced Export Query:**
```pseudocode
Update getTasksForExport():
  - Add reviewStatus filter logic
  - Add reviewScore range filtering
  - Add reviewer email filtering  
  - Add exportStatus filtering (for overrides)
  - Maintain backward compatibility
```

### PHASE 6: Administrative & Monitoring

#### 6.1 Export Status Report (`src/export/reporting.js` - NEW FILE)

**Status Dashboard:**
```pseudocode
function generateExportStatusReport()
  - Count tasks by export status
  - List active export batches in progress
  - Show failed exports requiring attention
  - Display staging folder usage
  - Return summary for admin display
```

**Admin Functions:**
```pseudocode
function listAllExportBatches()
  - Get all unique export batch IDs
  - Show status summary for each batch
  - Include staging and client folder links

function cleanupFailedExports(olderThanDays)
  - Reset failed export statuses older than X days
  - Clear abandoned export batch IDs
  - Return cleanup summary
```

#### 6.2 Menu Integration (`src/ui/menu.js`)

**Final Menu Structure:**
```javascript
Tools Submenu:
  - "Configure Staging Folder"
  - "Stage Tasks for Export"      // Main staging wizard
  - "Deliver Staged Export"       // Main delivery wizard
  - "Export Status Report"        // Admin dashboard
  - "Resume Failed Exports"       // Recovery functions
```

### PHASE 7: Migration & Compatibility

#### 7.1 Schema Migration

**Column Addition:**
```pseudocode
When EXPORT_STATUS column is first added:
  - All existing tasks have exportStatus = null
  - Previously exported tasks: use existing exportTime to infer 'delivered'
  - Run one-time migration script if needed
```

#### 7.2 Backward Compatibility

**Legacy Export Support:**
```pseudocode
Keep existing export functions as deprecated:
  - showExportWizard() → redirect to showStagingWizard()
  - Add warning about new two-phase process
  - Provide migration path for users
```

## Testing Strategy

### Unit Testing
- Test each status transition individually
- Test filter combinations
- Test error scenarios for each phase

### Integration Testing  
- Full staging workflow end-to-end
- Full delivery workflow end-to-end
- Recovery scenario testing
- Large export volume testing

### User Acceptance Testing
- Ops team workflow validation
- Error message clarity
- UI intuitiveness for two-phase process

## Implementation Order

1. **Phase 1**: Schema and configuration (foundation)
2. **Phase 2**: Staging system (core functionality)
3. **Phase 3**: Delivery system (complete workflow)
4. **Phase 4**: Error handling (robustness)
5. **Phase 5**: Enhanced UI (user experience)
6. **Phase 6**: Admin tools (operational support)
7. **Phase 7**: Migration and cleanup (deployment)

## Success Criteria

### Functional Requirements
- ✅ Tasks can be staged without client delivery
- ✅ Staged exports can be reviewed before delivery
- ✅ Failed operations can be recovered and retried
- ✅ Export sheets stay internal, task folders go to client
- ✅ All operations complete within Apps Script time limits

### Operational Requirements
- ✅ Ops team can review before client delivery
- ✅ Clear audit trail of staged vs. delivered
- ✅ Simple recovery from any failure point
- ✅ No client exposure to internal metadata
- ✅ Bulletproof reliability under all conditions

## File Structure Summary

### New Files to Create
- `src/export/wizard_staging.html` - Staging wizard UI
- `src/export/wizard_delivery.html` - Delivery wizard UI  
- `src/export/stagingHandlers.js` - Staging server functions
- `src/export/deliveryHandlers.js` - Delivery server functions
- `src/export/staging.js` - Core staging operations with validation
- `src/export/delivery.js` - Core delivery operations with validation
- `src/export/validation.js` - File validation functions (production file checks)
- `src/export/status.js` - Status management
- `src/export/recovery.js` - Error recovery
- `src/export/reporting.js` - Admin reporting

### Files to Modify
- `src/sheet/schema.js` - Add EXPORT_STATUS and STAGED_COUNT columns and values
- `src/sheet/queries.js` - Enhance getTasksForExport()  
- `src/export/filters.js` - Add review-based filters
- `src/ui/menu.js` - Add new menu items
- `src/ui/settings.js` - Add staging folder configuration

### Configuration
- PropertiesService: `STAGING_FOLDER_ID` setting
- Menu structure updates for two-phase process
- Recovery trigger functions for Apps Script

This implementation creates the "American muscle car" export system - powerful, reliable, and built to last without unnecessary complexity.