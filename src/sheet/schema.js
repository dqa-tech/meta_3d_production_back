/**
 * Sheet schema definition and initialization
 * Defines the structure of our data management sheet
 */

const SHEET_NAME = 'Tasks';

const COLUMNS = {
  TASK_ID: 'Task ID',
  BATCH_ID: 'Batch ID',
  GROUP: 'Group',
  FOLDER_NAME: 'Folder Name',
  IMPORT_TIME: 'Import Time',
  PRODUCTION_FOLDER_LINK: 'Production Folder',
  STATUS: 'Status',
  AGENT_EMAIL: 'Agent Email',
  START_TIME: 'Start Time',
  END_TIME: 'End Time',
  IMAGE_LINK: 'Image',
  IMG_MASK_LINK: 'Image Mask',
  MASK_LINK: 'Mask',
  OBJ_LINK: '3D Object',
  ALIGNMENT_LINK: 'Alignment',
  VIDEO_LINK: 'Task Video',
  EXPORT_TIME: 'Export Time',
  EXPORT_BATCH_ID: 'Export Batch',
  REVISION_COUNT: 'Revision Count',
  REVISION_HISTORY: 'Revision History',
  ORIGINAL_COMPLETION_TIME: 'Original Completion',
  PREVIOUS_AGENT_EMAIL: 'Previous Agent'
};

const COLUMN_ORDER = [
  'TASK_ID',
  'BATCH_ID',
  'GROUP',
  'FOLDER_NAME',
  'IMPORT_TIME',
  'PRODUCTION_FOLDER_LINK',
  'STATUS',
  'AGENT_EMAIL',
  'START_TIME',
  'END_TIME',
  'IMAGE_LINK',
  'IMG_MASK_LINK',
  'MASK_LINK',
  'OBJ_LINK',
  'ALIGNMENT_LINK',
  'VIDEO_LINK',
  'EXPORT_TIME',
  'EXPORT_BATCH_ID',
  'REVISION_COUNT',
  'REVISION_HISTORY',
  'ORIGINAL_COMPLETION_TIME',
  'PREVIOUS_AGENT_EMAIL'
];

const STATUS_VALUES = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
  FLAGGED: 'flagged',
  REWORK: 'rework'
};

const GROUP_VALUES = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D'
};

const HEADER_STYLE = {
  background: '#4285F4',
  fontColor: '#FFFFFF',
  fontSize: 10,
  fontWeight: 'bold',
  horizontalAlignment: 'center',
  verticalAlignment: 'middle',
  wrapStrategy: 'WRAP'
};

/**
 * Initialize the sheet with proper structure
 */
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    setupHeaders(sheet);
    applySheetFormatting(sheet);
  }
  
  return sheet;
}

/**
 * Set up column headers
 */
function setupHeaders(sheet) {
  const headers = COLUMN_ORDER.map(key => COLUMNS[key]);
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  
  headerRange.setValues([headers]);
  headerRange.setBackground(HEADER_STYLE.background);
  headerRange.setFontColor(HEADER_STYLE.fontColor);
  headerRange.setFontSize(HEADER_STYLE.fontSize);
  headerRange.setFontWeight(HEADER_STYLE.fontWeight);
  headerRange.setHorizontalAlignment(HEADER_STYLE.horizontalAlignment);
  headerRange.setVerticalAlignment(HEADER_STYLE.verticalAlignment);
  headerRange.setWrapStrategy(SpreadsheetApp.WrapStrategy[HEADER_STYLE.wrapStrategy]);
}

/**
 * Apply formatting to the sheet
 */
function applySheetFormatting(sheet) {
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  const widths = {
    1: 150,  // Task ID
    2: 120,  // Batch ID
    3: 60,   // Group
    4: 250,  // Folder Name
    5: 150,  // Import Time
    6: 200,  // Production Folder
    7: 100,  // Status
    8: 200,  // Agent Email
    9: 150,  // Start Time
    10: 150, // End Time
    11: 100, // Image
    12: 100, // Image Mask
    13: 100, // Mask
    14: 100, // 3D Object
    15: 100, // Alignment
    16: 100, // Task Video
    17: 150, // Export Time
    18: 120  // Export Batch
  };
  
  Object.entries(widths).forEach(([col, width]) => {
    sheet.setColumnWidth(parseInt(col), width);
  });
  
  // Add data validation for status column
  const statusColumn = COLUMN_ORDER.indexOf('STATUS') + 1;
  const statusRange = sheet.getRange(2, statusColumn, sheet.getMaxRows() - 1, 1);
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(STATUS_VALUES), true)
    .setAllowInvalid(false)
    .build();
  statusRange.setDataValidation(statusRule);
  
  // Add data validation for group column
  const groupColumn = COLUMN_ORDER.indexOf('GROUP') + 1;
  const groupRange = sheet.getRange(2, groupColumn, sheet.getMaxRows() - 1, 1);
  const groupRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.values(GROUP_VALUES), true)
    .setAllowInvalid(false)
    .build();
  groupRange.setDataValidation(groupRule);
}

/**
 * Get column index by name
 */
function getColumnIndex(columnKey) {
  return COLUMN_ORDER.indexOf(columnKey) + 1;
}

/**
 * Get the tasks sheet
 */
function getTasksSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || initializeSheet();
}