# 3D Data Management System

A Google Apps Script-based production management system for 3D rendering tasks. This system uses Google Sheets as a database and Google Drive for file operations, providing comprehensive workflow management from task import through completion and delivery.

## System Architecture

The system operates entirely within Google Workspace, leveraging Google Apps Script's serverless execution environment:

```
Import Drive Folders → Google Sheet Database → REST API ↔ Production Tools
                                 ↓
                        Review System → Export/Delivery
```

**Core Components:**
- **Google Sheet**: Primary database with full task lifecycle tracking
- **Drive Operations**: Bulk file operations with quota management
- **REST API**: Production tool integration via Google Apps Script web app
- **Import System**: Batch processing of client task folders
- **Export System**: Staging and delivery operations
- **Review System**: QC workflow with scoring and rework assignment

## Database Schema

The system uses a Google Sheet with the following column structure:

```javascript
// Core task identification
TASK_ID: UUID-based unique identifier
BATCH_ID: Import batch identifier (IMP_YYYYMMDD_HHMMSS_XXX)
GROUP: Permission group (A, B, C, D)
FOLDER_NAME: Task folder name (follows mc_*_*_hash_object_* pattern)

// Workflow tracking
STATUS: open | in_progress | complete | flagged | rework
AGENT_EMAIL: Assigned production agent
START_TIME: Task assignment timestamp
END_TIME: Task completion timestamp
TIME_TAKEN: Self-reported duration (HH:MM:SS format)

// File links (Google Drive URLs)
PRODUCTION_FOLDER_LINK: Drive folder containing all task files
IMAGE_LINK, IMG_MASK_LINK, MASK_LINK: Input file links
OBJ_LINK, ALIGNMENT_LINK, VIDEO_LINK: Output file links

// Review system
REVIEW_STATUS: pending | passed | failed
REVIEW_SCORE: 0-100 numeric score
REVIEWER_EMAIL: QC reviewer identifier
REVIEW_TIME: Review completion timestamp

// Revision tracking
REVISION_COUNT: Number of rework iterations
REVISION_HISTORY: JSON array of revision details
ORIGINAL_COMPLETION_TIME: First completion timestamp
PREVIOUS_AGENT_EMAIL: Agent who performed previous work

// Export tracking
EXPORT_STATUS: staging | staged | delivering | delivered | staging_failed | delivery_failed
EXPORT_BATCH_ID: Export batch identifier
STAGED_COUNT: Number of files staged for delivery
```

## REST API Specification

The API operates through a single Google Apps Script web app URL with path-based routing:

### Authentication
```javascript
// GET requests
{BASE_URL}?apiKey={key}&path=/api/endpoint&param=value

// POST requests
{
  "path": "/api/endpoint",
  "apiKey": "tm_xxxxxxxxxxxxx",
  "param": "value"
}
```

### Core Endpoints

**Task Assignment with Conflict Prevention:**
```javascript
POST /api/task/assign
{
  "taskId": "uuid",
  "agentEmail": "agent@example.com"
}

// Returns 409 Conflict if task already assigned
// Only allows assignment of 'open' or 'rework' status tasks
```

**Task Updates with Smart Review Handling:**
```javascript
POST /api/task/update
{
  "taskId": "uuid",
  "status": "complete",
  "objFileId": "drive-file-id",
  "alignmentFileId": "drive-file-id", 
  "videoFileId": ["video-id-1", "video-id-2"], // Always array
  "timeTaken": "1:30:45" // HH:MM:SS or MM:SS format
}

// Automatically sets reviewStatus to 'pending' on completion
// Handles reviewer self-completion with auto-approval
```

**QC Review with Automatic Rework Assignment:**
```javascript
POST /api/task/review
{
  "taskId": "uuid",
  "score": 75,
  "reviewerEmail": "reviewer@example.com"
}

// Pass threshold: 80 (configurable)
// Failed reviews trigger smart rework assignment:
//   - First failure: back to original agent
//   - Subsequent failures: assigned to reviewer
```

**Rework Management:**
```javascript
POST /api/task/rework
{
  "taskId": "uuid",
  "requestedBy": "lead@example.com",
  "reason": "Alignment needs adjustment"
}

// Archives current work to revision history
// Clears output files, maintains input files
// Increments revision counter
```

### Agent Permission System

Tasks are assigned to groups (A, B, C, D) during import. Agents have group permissions stored in the "Agents" sheet:

```
Agent Email              | Groups
------------------------|--------
agent1@example.com      | A
agent2@example.com      | A,B,C
agent3@example.com      | B,D
```

```javascript
GET /api/agent/groups?email=agent@example.com
// Returns: {"groups": ["A", "C"]}

GET /api/tasks?status=open
// Production tools filter results by agent's allowed groups
```

## Import System

**File Structure Validation:**
- Requires exactly 3 files: `image.jpg`, `img_mask.jpg`, `mask.jpg`
- Validates folder naming pattern: `mc_*_*_hash_object_*`
- Performs bulk Drive API operations for performance
- Generates production folders and copies source files

**Batch Processing:**
```javascript
// Import batch ID format
IMP_YYYYMMDD_HHMMSS_ABC1

// Bulk operations using Drive API v3
const folders = Drive.Files.list({
  q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
  pageSize: 1000,
  supportsAllDrives: true
});
```

## Export System

**Two-Stage Process:**
1. **Staging**: Copy files to staging folder, create export sheets
2. **Delivery**: Move staged files to final client destinations

**File Validation for Export:**
- Minimum 6 files (3 input + 3 output minimum)
- Validates presence of `.obj`, production `.jpg`, and `.mp4` files
- Uses folder name matching for output file identification

**Batch Export Management:**
```javascript
// Export batch folder structure
Export_YYYY-MM-DD_EXP_HHMMSS_XXX/
├── task_folder_1/
│   ├── image.jpg (original)
│   ├── img_mask.jpg (original)  
│   ├── mask.jpg (original)
│   ├── output.obj (production)
│   ├── output_alignment.jpg (production)
│   └── output_recording.mp4 (production)
└── Export_BatchID_Data.xlsx (task metadata)
```

## Error Handling

**Custom Error Classes:**
```javascript
class ValidationError extends AppError {
  constructor(message, field, value) {
    super(message, 'VALIDATION_ERROR', {field, value});
  }
}

class DriveError extends AppError {
  constructor(message, operation, fileId) {
    super(message, 'DRIVE_ERROR', {operation, fileId});
  }
}
```

**Systematic Logging:**
- All operations logged to hidden "_SystemLogs" sheet
- Error details include context (operation, IDs, timestamps)
- User-friendly error messages with technical details in logs

## Google Apps Script Constraints

**Execution Environment:**
- 6-minute maximum execution time per trigger
- No ES6 modules - all code in global scope
- No npm packages - pure Google Apps Script APIs
- URL fetch quota: 20,000 requests/day
- Drive API quotas apply to bulk operations

**Performance Optimizations:**
- Batch operations for Drive API calls
- Caching system for repeated folder/file access  
- Chunked processing to avoid timeouts
- Strategic sleep intervals in bulk operations

**Configuration via PropertiesService:**
```javascript
PropertiesService.getScriptProperties().setProperties({
  'PRODUCTION_FOLDER_ID': 'drive-folder-id',
  'STAGING_FOLDER_ID': 'staging-folder-id',
  'API_KEY': 'tm_generated_key',
  'REVIEW_THRESHOLD': '80'
});
```

## Testing Framework

**Comprehensive Test Suite:**
```javascript
// Run via Google Sheets menu: Advanced > Run Tests
// Tests cover:
// - Sheet operations and data integrity
// - UUID generation and validation
// - Drive operations and file handling
// - Import/export workflows
// - API endpoint functionality
// - Task lifecycle management
// - Rework and review systems
// - Duration validation and formatting
```

**Test Data Management:**
```javascript
// Cleanup function removes all TEST_* batch records
function cleanupTestData() {
  // Removes test records by batch ID pattern
}
```

## Task Lifecycle

```
Import → open → in_progress → complete → review (pending) → passed/failed
                    ↑              ↓                           ↓
                    └── ← rework ← ←──────────────────────────┘
                         (revision++)
```

**Status Transitions:**
- `open`: Available for assignment (new imports)
- `in_progress`: Assigned to agent, work in progress
- `complete`: Work finished, pending review (`reviewStatus: "pending"`)
- `rework`: Failed review or manual rework request
- `flagged`: Manual flag for issues requiring intervention

**Review Flow:**
- Completion automatically sets `reviewStatus: "pending"`
- QC review with score determines pass (≥80) or fail (<80)
- Failed reviews trigger automatic rework with smart assignment
- Reviewer completing own rework gets automatic approval

## Production Integration

**Typical Production Tool Workflow:**
1. Query available tasks by agent groups
2. Assign task (handles conflicts automatically)  
3. Download source files from `productionFolderLink`
4. Process 3D rendering
5. Upload output files to Drive
6. Update task with file IDs and completion status
7. QC reviewer scores completed work
8. Failed work returns to rework queue automatically

**File ID to URL Conversion:**
```javascript
// API accepts Drive file IDs, converts to viewable URLs
objFileId: "1abc123def456" → objLink: "https://drive.google.com/file/d/1abc123def456/view"
```

The system handles the complete 3D production workflow while leveraging Google Workspace's collaborative features and providing robust error handling and recovery mechanisms.