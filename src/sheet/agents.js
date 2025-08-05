/**
 * Agent sheet operations
 * Manages agent permissions and group mappings
 */

const AGENTS_SHEET_NAME = 'Agents';

const AGENT_COLUMNS = {
  EMAIL: 'Agent Email',
  GROUPS: 'Groups'
};

const AGENT_COLUMN_ORDER = ['EMAIL', 'GROUPS'];

/**
 * Initialize the agents sheet
 */
function initializeAgentsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(AGENTS_SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(AGENTS_SHEET_NAME);
    setupAgentHeaders(sheet);
    applyAgentSheetFormatting(sheet);
  }
  
  return sheet;
}

/**
 * Set up agent sheet headers
 */
function setupAgentHeaders(sheet) {
  const headers = AGENT_COLUMN_ORDER.map(key => AGENT_COLUMNS[key]);
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
 * Apply formatting to agents sheet
 */
function applyAgentSheetFormatting(sheet) {
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Set column widths
  sheet.setColumnWidth(1, 250); // Email
  sheet.setColumnWidth(2, 150); // Groups
  
  // Add data validation for groups column
  const groupsColumn = 2;
  const groupsRange = sheet.getRange(2, groupsColumn, sheet.getMaxRows() - 1, 1);
  
  // Note: Groups can be comma-separated, so we'll add a note instead of strict validation
  groupsRange.setNote('Enter comma-separated group letters (e.g., "A,C" or "B,C,D")');
}

/**
 * Get agent groups by email
 * @param {string} email - Agent email
 * @returns {Array} Array of group letters
 */
function getAgentGroups(email) {
  const sheet = getAgentsSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return [];
  }
  
  // Find agent row
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      const groupsStr = data[i][1] || '';
      // Split by comma and clean up whitespace
      return groupsStr.split(',').map(g => g.trim()).filter(g => g);
    }
  }
  
  return [];
}

/**
 * Add or update agent groups
 * @param {string} email - Agent email
 * @param {Array|string} groups - Groups array or comma-separated string
 */
function setAgentGroups(email, groups) {
  const sheet = getAgentsSheet();
  const data = sheet.getDataRange().getValues();
  
  // Convert groups to string if array
  const groupsStr = Array.isArray(groups) ? groups.join(',') : groups;
  
  // Find existing agent
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === email) {
      rowIndex = i + 1; // Sheet rows are 1-indexed
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing
    sheet.getRange(rowIndex, 2).setValue(groupsStr);
  } else {
    // Add new agent
    sheet.appendRow([email, groupsStr]);
  }
  
  info('Agent groups updated', {
    email: email,
    groups: groupsStr
  });
}

/**
 * Get all agents with their groups
 * @returns {Array} Array of {email, groups} objects
 */
function getAllAgents() {
  const sheet = getAgentsSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return [];
  }
  
  const agents = [];
  for (let i = 1; i < data.length; i++) {
    const email = data[i][0];
    const groupsStr = data[i][1] || '';
    
    if (email) {
      agents.push({
        email: email,
        groups: groupsStr.split(',').map(g => g.trim()).filter(g => g)
      });
    }
  }
  
  return agents;
}

/**
 * Get the agents sheet
 */
function getAgentsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(AGENTS_SHEET_NAME) || initializeAgentsSheet();
}

/**
 * Check if agent can work on a specific group
 * @param {string} email - Agent email
 * @param {string} group - Group letter to check
 * @returns {boolean} True if agent can work on the group
 */
function canAgentWorkOnGroup(email, group) {
  const agentGroups = getAgentGroups(email);
  return agentGroups.includes(group);
}