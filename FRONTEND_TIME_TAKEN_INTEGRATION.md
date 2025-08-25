# Time Taken Field - Frontend Integration Guide

## Overview

The `/api/task/update` endpoint now accepts an optional `timeTaken` parameter to capture self-reported task duration from agents completing 3D rendering tasks.

## API Changes Summary

- **Field Name**: `timeTaken`
- **Type**: String (optional)
- **Purpose**: Capture agent-reported task duration
- **Storage**: Normalized to HH:MM:SS format in backend
- **Backward Compatible**: Existing API calls continue to work

## Request Format

### Basic Update Request (NEW)
```javascript
POST /api/task/update
{
  "path": "/api/task/update",
  "apiKey": "your-api-key",
  "taskId": "uuid-here",
  "status": "complete",
  "timeTaken": "1:30:45",  // NEW FIELD - optional
  "objFileId": "file-id",
  "alignmentFileId": "alignment-id",
  "videoFileId": ["video-id-1", "video-id-2"]
}
```

### Response Format
```javascript
{
  "success": true,
  "task": {
    "taskId": "uuid-here",
    "status": "complete",
    "timeTaken": "01:30:45",  // Normalized to HH:MM:SS
    "endTime": "2025-08-19T12:00:00Z",
    // ... other fields
  },
  "timestamp": "2025-08-19T12:00:00Z"
}
```

## Accepted Duration Formats

The backend accepts flexible input formats and normalizes them:

| Input Format | Normalized Output | Description |
|--------------|-------------------|-------------|
| `"1:30:45"` | `"01:30:45"` | 1 hour 30 minutes 45 seconds |
| `"01:30:45"` | `"01:30:45"` | Already normalized |
| `"45:30"` | `"00:45:30"` | 45 minutes 30 seconds |
| `"5:15"` | `"00:05:15"` | 5 minutes 15 seconds |
| `"0:05:15"` | `"00:05:15"` | 5 minutes 15 seconds |

## Validation Rules

- **Format**: Must be HH:MM:SS or MM:SS
- **Maximum**: 99:59:59 (hours cannot exceed 99)
- **Minutes**: Must be 00-59
- **Seconds**: Must be 00-59
- **Optional**: Field can be omitted entirely

## Frontend Implementation

### 1. Duration Input Collection

```javascript
// Example: Timer-based duration tracking
class TaskTimer {
  constructor() {
    this.startTime = null;
    this.endTime = null;
  }
  
  start() {
    this.startTime = Date.now();
  }
  
  stop() {
    this.endTime = Date.now();
    return this.getDuration();
  }
  
  getDuration() {
    if (!this.startTime || !this.endTime) return null;
    
    const durationMs = this.endTime - this.startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    // Return in MM:SS format for times under 1 hour
    if (hours === 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Return in HH:MM:SS format for times over 1 hour
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
}
```

### 2. Manual Duration Input

```javascript
// Example: Manual time input form
function validateDurationInput(input) {
  // Allow MM:SS or HH:MM:SS formats
  const patterns = [
    /^(\d{1,2}):([0-5]\d):([0-5]\d)$/, // HH:MM:SS
    /^([0-5]?\d):([0-5]\d)$/           // MM:SS
  ];
  
  return patterns.some(pattern => pattern.test(input.trim()));
}

// HTML input example
/*
<input 
  type="text" 
  id="taskDuration" 
  placeholder="MM:SS or HH:MM:SS (e.g., 45:30 or 1:30:45)"
  pattern="^(\d{1,2}:)?[0-5]?\d:[0-5]\d$"
  title="Enter duration in MM:SS or HH:MM:SS format"
/>
*/
```

### 3. API Integration

```javascript
// Complete task submission with duration
async function submitCompletedTask(taskData) {
  const payload = {
    path: '/api/task/update',
    apiKey: CONFIG.API_KEY,
    taskId: taskData.id,
    status: 'complete',
    objFileId: taskData.files.obj,
    alignmentFileId: taskData.files.alignment,
    videoFileId: taskData.files.videos,
    endTime: new Date().toISOString()
  };
  
  // Add duration if available
  if (taskData.duration && taskData.duration.trim()) {
    payload.timeTaken = taskData.duration.trim();
  }
  
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Task update failed');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to submit task:', error);
    throw error;
  }
}
```

### 4. Error Handling

```javascript
function handleTimeTakenError(error) {
  if (error.field === 'timeTaken') {
    switch (true) {
      case error.message.includes('HH:MM:SS or MM:SS format'):
        return 'Please enter time in MM:SS or HH:MM:SS format (e.g., "45:30" or "1:30:45")';
      
      case error.message.includes('hours cannot exceed 99'):
        return 'Duration cannot exceed 99 hours';
      
      case error.message.includes('minutes cannot exceed 59'):
        return 'Minutes must be between 00 and 59';
      
      case error.message.includes('seconds cannot exceed 59'):
        return 'Seconds must be between 00 and 59';
      
      default:
        return 'Invalid time format. Use MM:SS or HH:MM:SS format.';
    }
  }
  
  return error.message;
}

// Usage in form validation
try {
  await submitCompletedTask(taskData);
  showSuccess('Task completed successfully!');
} catch (error) {
  const userMessage = handleTimeTakenError(error);
  showError(userMessage);
}
```

## UI/UX Recommendations

### 1. Input Field Design
```html
<!-- Recommended input field -->
<div class="duration-input-group">
  <label for="taskDuration">Time Taken (Optional)</label>
  <input 
    type="text" 
    id="taskDuration" 
    placeholder="45:30"
    pattern="^(\d{1,2}:)?[0-5]?\d:[0-5]\d$"
    title="Enter duration in MM:SS or HH:MM:SS format"
  />
  <small class="help-text">
    Format: MM:SS (e.g., 45:30) or HH:MM:SS (e.g., 1:30:45)
  </small>
</div>
```

### 2. Auto-Timer Integration
```javascript
// Automatic duration tracking
class TaskSession {
  constructor(taskId) {
    this.taskId = taskId;
    this.timer = new TaskTimer();
    this.manualOverride = false;
  }
  
  startWork() {
    this.timer.start();
    this.updateUI();
  }
  
  finishWork() {
    const autoDuration = this.timer.stop();
    
    // Show auto-calculated duration with option to override
    this.showCompletionDialog(autoDuration);
  }
  
  showCompletionDialog(suggestedDuration) {
    // Display modal with:
    // 1. Auto-calculated duration (pre-filled)
    // 2. Option to manually override
    // 3. Submit button
    
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div class="completion-modal">
        <h3>Complete Task</h3>
        <label>
          Time Taken: 
          <input 
            type="text" 
            id="finalDuration" 
            value="${suggestedDuration}"
            placeholder="MM:SS or HH:MM:SS"
          />
        </label>
        <p><small>Auto-calculated: ${suggestedDuration} (editable)</small></p>
        <button onclick="this.submitWithDuration()">Complete Task</button>
      </div>
    `;
  }
}
```

### 3. Validation Feedback
```javascript
// Real-time validation
function setupDurationValidation() {
  const input = document.getElementById('taskDuration');
  const feedback = document.getElementById('duration-feedback');
  
  input.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    if (!value) {
      feedback.textContent = '';
      feedback.className = '';
      return;
    }
    
    if (validateDurationInput(value)) {
      feedback.textContent = '✓ Valid format';
      feedback.className = 'feedback-success';
    } else {
      feedback.textContent = '⚠ Use MM:SS or HH:MM:SS format (e.g., 45:30)';
      feedback.className = 'feedback-error';
    }
  });
}
```

## Testing Scenarios

### Valid Inputs to Test
```javascript
const validDurations = [
  "5:30",      // 5 minutes 30 seconds
  "45:15",     // 45 minutes 15 seconds
  "1:30:45",   // 1 hour 30 minutes 45 seconds
  "01:30:45",  // Same with leading zero
  "0:05:30",   // 5 minutes 30 seconds
  "59:59",     // Maximum minutes/seconds
  "99:59:59"   // Maximum allowed duration
];
```

### Invalid Inputs to Test
```javascript
const invalidDurations = [
  "100:00:00", // Hours > 99
  "1:60:30",   // Minutes > 59
  "1:30:60",   // Seconds > 59
  "invalid",   // Non-numeric
  "1:2:3",     // Missing zero padding (backend will reject)
  "",          // Empty string (should be omitted)
  "1:2"        // Ambiguous format
];
```

## Migration Checklist

- [ ] Update API payload to include optional `timeTaken` field
- [ ] Implement duration input UI component
- [ ] Add client-side validation for duration format
- [ ] Update error handling for timeTaken validation errors
- [ ] Test with various duration formats
- [ ] Verify backward compatibility (existing calls without timeTaken)
- [ ] Update user documentation/help text
- [ ] Test auto-timer functionality (if implemented)
- [ ] Verify data appears correctly in admin views

## Support

For questions about the timeTaken field implementation:

1. Check API_DOCUMENTATION.md for complete technical details
2. Test against the validation rules above
3. Verify your API key has proper permissions
4. Contact system administrator for backend issues

---

**Note**: This field is optional and backward compatible. Existing frontend implementations will continue to work without modification.