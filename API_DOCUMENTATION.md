# 3D Data Management System - API Documentation

## Overview

The 3D Data Management API provides programmatic access to task management functionality for the 3D production tool. All endpoints require authentication via API key.

## Base URL

```
https://script.google.com/macros/s/1MR_qxROmEkyeR55Sk5T4f9fnyG_mmlpJge4QBvownuBj9Z4O5Q4w8ImS/exec
```

## Authentication

The API key must be included in one of these ways:

1. **As a parameter** (recommended for Google Apps Script):
```
GET {BASE_URL}?apiKey=tm_w2HOpYy83Cvj7htycEbKupK8eAzaQPpG&path=/api/tasks
```

2. **In the request body** (for POST requests):
```javascript
{
  "path": "/api/endpoint",
  "apiKey": "tm_w2HOpYy83Cvj7htycEbKupK8eAzaQPpG",
  "param1": "value1"
}
```

To obtain your API key:
1. Open the Google Sheet
2. Go to Menu → 3D Data Manager → Advanced → Show API Key

## Request Format

For Google Apps Script Web App, all endpoints use a single URL with different request formats:

**POST requests**: Include the endpoint path and API key in the request body
```javascript
POST {BASE_URL}
Content-Type: application/json

{
  "path": "/api/endpoint",
  "apiKey": "your-api-key",
  "param1": "value1",
  "param2": "value2"
}
```

**GET requests**: Include the path and API key as query parameters
```javascript
GET {BASE_URL}?apiKey=your-api-key&path=/api/endpoint&param1=value1&param2=value2
```

## Response Format

All responses return JSON with this structure:

```javascript
// Success
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-08-04T12:00:00Z"
}

// Error
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "timestamp": "2025-08-04T12:00:00Z"
  }
}
```

## Quick Endpoint Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/api/tasks` | Get filtered list of tasks |
| **GET** | `/api/task` | Get single task details |
| **GET** | `/api/status` | Check API status |
| **GET** | `/api/agent/groups` | Get agent's allowed groups |
| **GET** | `/api/agent/history` | Get agent's task history |
| **POST** | `/api/task/assign` | Assign task to agent |
| **POST** | `/api/task/update` | Update task with artifacts |
| **POST** | `/api/task/rework` | Mark task for rework |
| **POST** | `/api/tasks/batch` | Batch update multiple tasks |

## Detailed Endpoint Documentation

### 1. Get Available Tasks

Retrieves all open tasks available for assignment.

**Request:**
```javascript
GET {BASE_URL}?apiKey=your-api-key&path=/api/tasks&status=open&limit=100&offset=0
```

**Parameters:**
- `status` (optional): Filter by status - single value or comma-separated list
  - Single: `status=in_progress`
  - Multiple: `status=in_progress,rework`
  - Valid values: `open`, `in_progress`, `complete`, `flagged`, `rework`
- `batchId` (optional): Filter by batch ID
- `agentEmail` (optional): Filter by assigned agent
- `limit` (optional): Max results to return (default: 100, max: 1000)
- `offset` (optional): Pagination offset (default: 0)
- `fields` (optional): Comma-separated list of fields to return (for lightweight responses)
  - Example: `fields=taskId,folderName,productionFolderLink,revisionCount`
- `includeHistory` (optional): Include revision history if `true` (default: `false`)

**Response:**
```javascript
{
  "success": true,
  "tasks": [
    {
      "taskId": "uuid-here",
      "batchId": "IMP_20250804_120000_ABC1",
      "group": "A",
      "folderName": "mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0",
      "status": "open",
      "importTime": "2025-08-04T10:00:00Z",
      "productionFolderLink": "https://drive.google.com/drive/folders/xxx",
      "imageLink": "https://drive.google.com/file/d/xxx/view",
      "imgMaskLink": "https://drive.google.com/file/d/yyy/view",
      "maskLink": "https://drive.google.com/file/d/zzz/view",
      "agentEmail": null,
      "startTime": null,
      "endTime": null,
      "objLink": null,
      "alignmentLink": null,
      "videoLink": null
    }
  ],
  "count": 50,
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### 2. Get Single Task

Retrieves details for a specific task.

**Request:**
```javascript
GET {BASE_URL}?path=/api/task&taskId=uuid-here
```

**Response:**
```javascript
{
  "success": true,
  "task": {
    "taskId": "uuid-here",
    "batchId": "IMP_20250804_120000_ABC1",
    "group": "A",
    "folderName": "mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0",
    "status": "in_progress",
    "agentEmail": "agent@example.com",
    "startTime": "2025-08-04T11:00:00Z",
    // ... all other fields
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### 3. Assign Task to Agent

Assigns an open task to an agent and marks it as in_progress.

**Request:**
```javascript
POST {BASE_URL}
{
  "path": "/api/task/assign",
  "taskId": "uuid-here",
  "agentEmail": "agent@example.com"
}
```

**Response:**
```javascript
{
  "success": true,
  "task": {
    "taskId": "uuid-here",
    "status": "in_progress",
    "agentEmail": "agent@example.com",
    "startTime": "2025-08-04T11:00:00Z"
    // ... other fields
  },
  "message": "Task assigned to agent@example.com",
  "timestamp": "2025-08-04T11:00:00Z"
}
```

### 4. Update Task

Updates task with production artifacts and status.

**Request:**
```javascript
POST {BASE_URL}
{
  "path": "/api/task/update",
  "taskId": "uuid-here",
  "status": "complete",
  "objFileId": "drive-file-id-for-obj",
  "alignmentFileId": "drive-file-id-for-alignment",
  "videoFileId": "drive-file-id-for-video"
}
```

**Parameters:**
- `taskId` (required): Task UUID
- `status` (optional): New status
- `agentEmail` (optional): Assign/reassign agent
- `objFileId` (optional): Google Drive file ID for .obj file
- `alignmentFileId` (optional): Google Drive file ID for alignment image
- `videoFileId` (optional): Array of Google Drive file IDs for task videos (always an array, even for single video)
- `startTime` (optional): ISO timestamp
- `endTime` (optional): ISO timestamp

**Response:**
```javascript
{
  "success": true,
  "task": {
    "taskId": "uuid-here",
    "status": "complete",
    "endTime": "2025-08-04T12:00:00Z",
    "objLink": "https://drive.google.com/file/d/xxx/view",
    "alignmentLink": "https://drive.google.com/file/d/yyy/view",
    "videoLink": "https://drive.google.com/file/d/zzz/view"
    // ... other fields
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### 5. Batch Update Tasks

Update multiple tasks in a single request.

**Request:**
```javascript
POST {BASE_URL}
{
  "path": "/api/tasks/batch",
  "tasks": [
    {
      "taskId": "uuid-1",
      "status": "complete",
      "objFileId": "file-id-1"
    },
    {
      "taskId": "uuid-2",
      "status": "flagged",
      "agentEmail": "agent2@example.com"
    }
  ]
}
```

**Response:**
```javascript
{
  "success": true,
  "results": [
    {
      "taskId": "uuid-1",
      "success": true,
      "task": { ... }
    },
    {
      "taskId": "uuid-2",
      "success": false,
      "error": "Task not found"
    }
  ],
  "summary": {
    "total": 2,
    "successful": 1,
    "failed": 1
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### 6. Get Agent Groups

Get the allowed groups for a specific agent.

**Request:**
```javascript
GET {BASE_URL}?apiKey=your-api-key&path=/api/agent/groups&email=agent@example.com
```

**Parameters:**
- `email` (required): Agent email address

**Response:**
```javascript
{
  "success": true,
  "agentEmail": "agent@example.com",
  "groups": ["A", "C"],
  "timestamp": "2025-08-04T12:00:00Z"
}
```

### 7. Mark Task for Rework

Transition a completed task to rework status for revision.

**Request:**
```javascript
POST {BASE_URL}
{
  "path": "/api/task/rework",
  "apiKey": "your-api-key",
  "taskId": "uuid-here",
  "requestedBy": "lead@example.com",
  "reason": "Alignment needs adjustment"  // Optional
}
```

**Parameters:**
- `taskId` (required): Task UUID to mark for rework
- `requestedBy` (required): Email of person requesting rework
- `reason` (optional): Reason for rework (max 500 characters)

**Response:**
```javascript
{
  "success": true,
  "task": {
    "taskId": "uuid-here",
    "status": "rework",
    "revisionCount": 1,
    "previousAgentEmail": "original@example.com",
    "reworkRequestedBy": "lead@example.com",
    "reworkRequestedTime": "2025-08-04T12:00:00Z"
    // Output fields cleared (objLink, alignmentLink, videoLink)
  },
  "message": "Task marked for rework (revision 1)",
  "timestamp": "2025-08-04T12:00:00Z"
}
```

**Notes:**
- Only tasks with `complete` status can be marked for rework
- Archives current work to revision history
- Clears output files (obj, alignment, video links)
- Task becomes available for assignment again with `rework` status

### 8. Get Agent History

Retrieve an agent's task history with lightweight task data.

**Request:**
```javascript
GET {BASE_URL}?apiKey=your-api-key&path=/api/agent/history&email=agent@example.com
```

**Parameters:**
- `email` or `agentEmail` (required): Agent's email address

**Response:**
```javascript
{
  "success": true,
  "agent": "agent@example.com",
  "summary": {
    "totalCompleted": 45,
    "totalReworked": 3,
    "currentlyWorking": 2
  },
  "completedTasks": [
    {
      "taskId": "uuid-123",
      "folderName": "mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0",
      "productionFolderLink": "https://drive.google.com/drive/folders/abc123",
      "completedAt": "2025-08-04T10:00:00Z",
      "revisionCount": 0,
      "status": "complete"
    }
    // ... more tasks
  ],
  "reworkedTasks": [...],  // Tasks where this agent's work was revised
  "inProgressTasks": [...],
  "timestamp": "2025-08-04T12:00:00Z"
}
```

**Key Fields:**
- `productionFolderLink`: Google Drive folder containing all source files (image.jpg, img_mask.jpg, mask.jpg)
- Provides complete task context without loading individual files
- Lightweight response optimized for task history panels

### 9. API Status Check

Verify API connectivity and authentication.

**Request:**
```javascript
GET {BASE_URL}?path=/api/status
```

**Response:**
```javascript
{
  "success": true,
  "status": "operational",
  "version": "1.0.0",
  "endpoints": [
    "POST /api/task/update",
    "POST /api/task/assign",
    "POST /api/task/rework",
    "POST /api/tasks/batch",
    "GET /api/task",
    "GET /api/tasks",
    "GET /api/status",
    "GET /api/agent/groups",
    "GET /api/agent/history"
  ],
  "timestamp": "2025-08-04T12:00:00Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters |
| `API_ERROR` | General API error |
| `DRIVE_ERROR` | Google Drive operation failed |
| `SHEET_ERROR` | Sheet operation failed |
| `UNKNOWN_ERROR` | Unexpected error |

## Status Values

Tasks can have one of these status values:
- `open` - Available for assignment
- `in_progress` - Assigned and being worked on
- `complete` - Finished with all artifacts uploaded
- `flagged` - Marked for review/issues
- `rework` - Completed task marked for revision (available for reassignment)

## Rate Limits

- Maximum 100 requests per minute
- Batch operations count as single requests
- HTTP 429 returned when rate limit exceeded

## Example Usage

### JavaScript/Node.js

```javascript
const API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
const API_KEY = 'tm_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Get all open tasks
async function getOpenTasks() {
  const url = `${API_URL}?apiKey=${API_KEY}&path=/api/tasks&status=open`;
  const response = await fetch(url, {
    method: 'GET'
  });
  
  const data = await response.json();
  return data.tasks;
}

// Assign task to agent
async function assignTask(taskId, agentEmail) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path: '/api/task/assign',
      apiKey: API_KEY,
      taskId: taskId,
      agentEmail: agentEmail
    })
  });
  
  return await response.json();
}

// Complete task with artifacts
async function completeTask(taskId, fileIds) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      path: '/api/task/update',
      apiKey: API_KEY,
      taskId: taskId,
      status: 'complete',
      objFileId: fileIds.obj,
      alignmentFileId: fileIds.alignment,
      videoFileId: fileIds.videos,  // Array of video IDs
      endTime: new Date().toISOString()
    })
  });
  
  return await response.json();
}

// Get lightweight task history
async function getAgentHistory(agentEmail) {
  const url = `${API_URL}?apiKey=${API_KEY}&path=/api/agent/history&email=${agentEmail}`;
  const response = await fetch(url);
  return await response.json();
}

// Get tasks with specific fields only
async function getTasksLightweight(agentEmail, status) {
  const url = `${API_URL}?apiKey=${API_KEY}&path=/api/tasks` +
    `&agentEmail=${agentEmail}&status=${status}` +
    `&fields=taskId,folderName,productionFolderLink,revisionCount`;
  const response = await fetch(url);
  return await response.json();
}

// Mark task for rework
async function reworkTask(taskId, reason) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: '/api/task/rework',
      apiKey: API_KEY,
      taskId: taskId,
      requestedBy: currentUser.email,
      reason: reason
    })
  });
  return await response.json();
}
```

### Python

```python
import requests
import json

API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec'
API_KEY = 'tm_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'

headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
}

# Get open tasks
def get_open_tasks():
    payload = {
        'path': '/api/tasks',
        'status': 'open'
    }
    response = requests.post(API_URL, 
                           headers=headers, 
                           data=json.dumps(payload))
    return response.json()['tasks']

# Assign task
def assign_task(task_id, agent_email):
    payload = {
        'path': '/api/task/assign',
        'taskId': task_id,
        'agentEmail': agent_email
    }
    response = requests.post(API_URL, 
                           headers=headers, 
                           data=json.dumps(payload))
    return response.json()
```

## Best Practices

1. **Cache task data** to minimize API calls
2. **Use batch operations** when updating multiple tasks
3. **Handle errors gracefully** - tasks may be assigned by other agents
4. **Store task images locally** after first fetch for performance
5. **Implement exponential backoff** for retries on failures

## Group System

The API includes a group-based permission system that controls which tasks agents can work on.

### Group Overview

- **Task Groups**: Each task belongs to a group (A, B, C, or D) assigned during import
- **Agent Groups**: Each agent can be authorized to work on one or more groups
- **Access Control**: Agents can only claim tasks from their authorized groups

### Group Assignment

Groups are assigned at the batch level during import:
- All tasks in an import batch receive the same group
- Groups cannot be changed after import
- Default group is 'A' if not specified

### Agent Group Management

Agent permissions are stored in the "Agents" sheet with the following structure:
- **Column A**: Agent Email
- **Column B**: Groups (comma-separated, e.g., "A,C")

Example:
```
Agent Email              | Groups
------------------------|--------
agent1@example.com      | A
agent2@example.com      | A,B,C
agent3@example.com      | B,D
```

## Updated Task Schema

All task objects now include the `group` field:

```javascript
{
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "batchId": "IMP_20250804_120000_ABC1",
  "group": "A",                                    // NEW: Group assignment (A, B, C, or D)
  "folderName": "mc_0_1300_e795115_saucer_0",
  "status": "open",
  "importTime": "2025-08-04T10:00:00Z",
  "productionFolderLink": "https://drive.google.com/drive/folders/xxx",
  "imageLink": "https://drive.google.com/file/d/xxx/view",
  "imgMaskLink": "https://drive.google.com/file/d/yyy/view",
  "maskLink": "https://drive.google.com/file/d/zzz/view",
  "agentEmail": null,
  "startTime": null,
  "endTime": null,
  "objLink": null,
  "alignmentLink": null,
  "videoLink": null
}
```

## Example: Group-Based Task Filtering

```javascript
// Get agent's allowed groups
async function getAgentGroups(agentEmail) {
  const url = `${API_URL}?apiKey=${API_KEY}&path=/api/agent/groups&email=${agentEmail}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.groups; // e.g., ["A", "C"]
}

// Get available tasks for an agent
async function getTasksForAgent(agentEmail) {
  // First, get agent's groups
  const allowedGroups = await getAgentGroups(agentEmail);
  
  // Get all available tasks
  const url = `${API_URL}?apiKey=${API_KEY}&path=/api/tasks&status=open`;
  const response = await fetch(url);
  const data = await response.json();
  
  // Filter tasks by agent's allowed groups
  const availableTasks = data.tasks.filter(task => 
    allowedGroups.includes(task.group)
  );
  
  return availableTasks;
}
```

## Support

For API issues or questions:
1. Check the API status endpoint first
2. Review error messages and codes
3. Contact the system administrator with request details