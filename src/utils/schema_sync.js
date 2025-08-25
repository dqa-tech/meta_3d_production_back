/**
 * Schema synchronization utilities
 * Ensures sheet column order matches schema definition
 */

/**
 * Check if sheet headers match schema order
 * @param {Sheet} sheet - Google Sheets object
 * @returns {Object} Comparison result
 */
function validateSchemaOrder(sheet) {
  if (!sheet) {
    sheet = getTasksSheet();
  }
  
  const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const expectedHeaders = COLUMN_ORDER.map(key => COLUMNS[key]);
  
  const result = {
    isValid: true,
    mismatches: [],
    missingColumns: [],
    extraColumns: [],
    actualOrder: actualHeaders,
    expectedOrder: expectedHeaders
  };
  
  // Check for length mismatch
  if (actualHeaders.length !== expectedHeaders.length) {
    result.isValid = false;
  }
  
  // Check each position
  for (let i = 0; i < Math.max(actualHeaders.length, expectedHeaders.length); i++) {
    const actual = actualHeaders[i] || null;
    const expected = expectedHeaders[i] || null;
    
    if (actual !== expected) {
      result.isValid = false;
      result.mismatches.push({
        position: i + 1,
        actual: actual,
        expected: expected
      });
    }
  }
  
  // Find missing columns (in schema but not in sheet)
  expectedHeaders.forEach((header, index) => {
    if (!actualHeaders.includes(header)) {
      result.missingColumns.push({
        header: header,
        expectedPosition: index + 1,
        columnKey: COLUMN_ORDER[index]
      });
    }
  });
  
  // Find extra columns (in sheet but not in schema)
  actualHeaders.forEach((header, index) => {
    if (!expectedHeaders.includes(header)) {
      result.extraColumns.push({
        header: header,
        currentPosition: index + 1
      });
    }
  });
  
  return result;
}

/**
 * Reorganize sheet columns to match schema order
 * @param {Sheet} sheet - Google Sheets object  
 * @param {boolean} dryRun - If true, only simulate changes
 * @returns {Object} Operation result
 */
function syncSchemaOrder(sheet, dryRun = false) {
  if (!sheet) {
    sheet = getTasksSheet();
  }
  
  const validation = validateSchemaOrder(sheet);
  
  if (validation.isValid) {
    return {
      success: true,
      message: 'Schema order already correct',
      changes: []
    };
  }
  
  const changes = [];
  const dataRange = sheet.getDataRange();
  const allData = dataRange.getValues();
  
  if (allData.length === 0) {
    return {
      success: false,
      message: 'Sheet is empty',
      changes: []
    };
  }
  
  const actualHeaders = allData[0];
  const expectedHeaders = COLUMN_ORDER.map(key => COLUMNS[key]);
  
  // Create mapping from expected to actual positions
  const columnMapping = {};
  const newData = [];
  
  // Map each expected column to its current position (if exists)
  expectedHeaders.forEach((expectedHeader, newIndex) => {
    const currentIndex = actualHeaders.findIndex(h => h === expectedHeader);
    columnMapping[newIndex] = currentIndex;
    
    if (currentIndex === -1) {
      changes.push({
        action: 'add',
        column: expectedHeader,
        position: newIndex + 1,
        reason: 'Missing from sheet'
      });
    } else if (currentIndex !== newIndex) {
      changes.push({
        action: 'move',
        column: expectedHeader,
        from: currentIndex + 1,
        to: newIndex + 1
      });
    }
  });
  
  // Note extra columns that will be removed
  actualHeaders.forEach((actualHeader, index) => {
    if (!expectedHeaders.includes(actualHeader)) {
      changes.push({
        action: 'remove',
        column: actualHeader,
        position: index + 1,
        reason: 'Not in schema'
      });
    }
  });
  
  if (dryRun) {
    return {
      success: true,
      message: 'Dry run completed',
      changes: changes,
      wouldModify: changes.length > 0
    };
  }
  
  // Reorganize data to match schema order
  for (let rowIndex = 0; rowIndex < allData.length; rowIndex++) {
    const oldRow = allData[rowIndex];
    const newRow = new Array(expectedHeaders.length);
    
    // Map data to new positions
    for (let newColIndex = 0; newColIndex < expectedHeaders.length; newColIndex++) {
      const oldColIndex = columnMapping[newColIndex];
      
      if (oldColIndex !== -1 && oldColIndex < oldRow.length) {
        // Move existing data
        newRow[newColIndex] = oldRow[oldColIndex];
      } else {
        // Add empty cell for missing columns
        newRow[newColIndex] = rowIndex === 0 ? expectedHeaders[newColIndex] : '';
      }
    }
    
    newData.push(newRow);
  }
  
  try {
    // Clear the sheet and write reorganized data
    sheet.clear();
    
    if (newData.length > 0) {
      sheet.getRange(1, 1, newData.length, expectedHeaders.length)
        .setValues(newData);
    }
    
    // Reapply formatting
    applySheetFormatting(sheet);
    
    info('Schema sync completed', {
      changes: changes.length,
      rows: newData.length,
      columns: expectedHeaders.length
    });
    
    return {
      success: true,
      message: `Schema synchronized successfully. ${changes.length} changes applied.`,
      changes: changes
    };
    
  } catch (error) {
    error('Schema sync failed', { error: error.message });
    
    return {
      success: false,
      message: `Schema sync failed: ${error.message}`,
      changes: []
    };
  }
}

/**
 * Add missing columns to sheet without reordering
 * @param {Sheet} sheet - Google Sheets object
 * @returns {Object} Operation result
 */
function addMissingColumns(sheet) {
  if (!sheet) {
    sheet = getTasksSheet();
  }
  
  const validation = validateSchemaOrder(sheet);
  
  if (validation.missingColumns.length === 0) {
    return {
      success: true,
      message: 'No missing columns',
      added: []
    };
  }
  
  const dataRange = sheet.getDataRange();
  const allData = dataRange.getValues();
  const currentColCount = sheet.getLastColumn();
  
  try {
    // Add missing columns at the end
    validation.missingColumns.forEach(missing => {
      // Insert column
      sheet.insertColumnAfter(currentColCount);
      
      // Set header
      sheet.getRange(1, currentColCount + 1)
        .setValue(missing.header);
      
      info('Added missing column', {
        header: missing.header,
        position: currentColCount + 1
      });
    });
    
    return {
      success: true,
      message: `Added ${validation.missingColumns.length} missing columns`,
      added: validation.missingColumns
    };
    
  } catch (error) {
    return {
      success: false,
      message: `Failed to add columns: ${error.message}`,
      added: []
    };
  }
}

/**
 * Menu function to check schema order
 */
function checkSchemaOrder() {
  const ui = SpreadsheetApp.getUi();
  const validation = validateSchemaOrder();
  
  if (validation.isValid) {
    ui.alert('Schema Check', 'Sheet columns are in correct order!', ui.ButtonSet.OK);
  } else {
    let message = 'Schema order issues found:\n\n';
    
    if (validation.mismatches.length > 0) {
      message += 'Position Mismatches:\n';
      validation.mismatches.forEach(mm => {
        message += `  Col ${mm.position}: Expected "${mm.expected}", Got "${mm.actual}"\n`;
      });
    }
    
    if (validation.missingColumns.length > 0) {
      message += '\nMissing Columns:\n';
      validation.missingColumns.forEach(mc => {
        message += `  "${mc.header}" (should be at position ${mc.expectedPosition})\n`;
      });
    }
    
    if (validation.extraColumns.length > 0) {
      message += '\nExtra Columns:\n';
      validation.extraColumns.forEach(ec => {
        message += `  "${ec.header}" (at position ${ec.currentPosition})\n`;
      });
    }
    
    message += '\nWould you like to fix these issues?';
    
    const response = ui.alert('Schema Issues Found', message, ui.ButtonSet.YES_NO);
    
    if (response === ui.Button.YES) {
      fixSchemaOrder();
    }
  }
}

/**
 * Menu function to fix schema order
 */
function fixSchemaOrder() {
  const ui = SpreadsheetApp.getUi();
  
  // Show dry run first
  const dryRun = syncSchemaOrder(null, true);
  
  if (!dryRun.wouldModify) {
    ui.alert('No Changes Needed', 'Schema is already correct!', ui.ButtonSet.OK);
    return;
  }
  
  let message = 'The following changes will be made:\n\n';
  dryRun.changes.forEach(change => {
    switch (change.action) {
      case 'move':
        message += `  • Move "${change.column}" from position ${change.from} to ${change.to}\n`;
        break;
      case 'add':
        message += `  • Add "${change.column}" at position ${change.position}\n`;
        break;
      case 'remove':
        message += `  • Remove "${change.column}" from position ${change.position}\n`;
        break;
    }
  });
  
  message += '\nProceed with these changes?';
  
  const response = ui.alert('Confirm Schema Sync', message, ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    const result = syncSchemaOrder();
    
    if (result.success) {
      ui.alert('Success', result.message, ui.ButtonSet.OK);
    } else {
      ui.alert('Error', result.message, ui.ButtonSet.OK);
    }
  }
}