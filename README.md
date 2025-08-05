# 3D Data Management System

A Google Apps Script-based system for managing 3D rendering tasks, providing import/export functionality and REST API integration for production tools.

## 🎯 Purpose

This system streamlines the workflow for 3D rendering projects by:
- **Importing** client task folders from Google Drive
- **Tracking** production progress in a centralized Google Sheet
- **Integrating** with 3D production tools via REST API
- **Exporting** completed tasks back to client folders

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Import Folder  │ --> │  Google Sheet    │ <-- │ Production Tool │
│  (Client Drive) │     │  (Central DB)    │     │    (API)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               v
                        ┌──────────────────┐
                        │  Export Folder   │
                        │  (Client Drive)  │
                        └──────────────────┘
```

## 📁 Project Structure

```
src/
├── api/            # REST API endpoints
├── drive/          # Google Drive operations
├── export/         # Export functionality
├── import/         # Import functionality
├── sheet/          # Sheet data operations
├── tests/          # Test suite
├── ui/             # User interface components
├── utils/          # Utility functions
└── main.js         # Entry point
```

## ✨ Features

### Import System
- Batch import of task folders
- Automatic validation of folder structure
- Duplicate detection
- Progress tracking
- Batch ID generation

### Production Tracking
- Task assignment to agents
- Status tracking (open, in_progress, complete, flagged)
- Time tracking
- File link management

### Export System
- Dynamic filtering (batch, agent, date, status)
- Selective file export
- Batch export operations
- Export history tracking

### REST API
- Task updates from production tools
- Agent assignment
- Batch operations
- Secure API key authentication

## 🚀 Quick Start

1. **Deploy to Google Sheets** - See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. **Configure Production Folder** - Set in script properties
3. **Import Tasks** - Use menu: 3D Data Manager > Import Tasks
4. **Track Production** - Monitor progress in the sheet
5. **Export Results** - Use menu: 3D Data Manager > Export Tasks

## 📊 Data Structure

### Task Folder Format
```
mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0/
├── image.jpg
├── img_mask.jpg
└── mask.jpg
```

### Production Output
```
mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0/
├── image.jpg
├── img_mask.jpg
├── mask.jpg
├── mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0.obj
├── mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0_alignment.jpg
└── mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0_recording.mp4
```

## 🔌 API Integration

### Update Task
```javascript
POST /api/task/update
{
  "taskId": "uuid",
  "status": "complete",
  "objFileId": "drive-file-id",
  "alignmentFileId": "drive-file-id",
  "videoFileId": "drive-file-id"
}
```

### Query Tasks
```javascript
GET /api/tasks?batchId=IMP_001&status=open
```

## 🛠️ Development

### Code Style
- Small, focused functions (< 50 lines)
- Modular file structure (< 500 lines/file)
- Clear naming conventions
- Comprehensive error handling

### Testing
Run tests from menu: Advanced > Run Tests

### Logging
System logs stored in hidden "_SystemLogs" sheet

## 📝 Configuration

### Script Properties
- `PRODUCTION_FOLDER_ID` - Main production folder
- `API_KEY` - Auto-generated API key

### Permissions Required
- Google Drive access
- Google Sheets access
- Web app deployment (for API)

## 🔒 Security

- API key authentication
- Domain-restricted access options
- Audit logging
- Permission validation

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- Code comments throughout
- Built-in help menu

## 🤝 Contributing

1. Follow existing code patterns
2. Maintain test coverage
3. Update documentation
4. Test thoroughly before deployment

## 📄 License

Internal use only - Proprietary system

---

Built with ❤️ using Google Apps Script