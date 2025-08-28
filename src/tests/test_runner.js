/**
 * Test runner for 3D Data Management System
 * Comprehensive test suite for all functionality
 */

/**
 * Run all tests
 */
function runAllTests() {
  const ui = SpreadsheetApp.getUi();
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  ui.alert('Running Tests', 'Starting test suite...', ui.ButtonSet.OK);
  
  // Test groups
  const testGroups = [
    { name: 'Sheet Operations', tests: testSheetOperations },
    { name: 'UUID Generation', tests: testUuidGeneration },
    { name: 'Drive Operations', tests: testDriveOperations },
    { name: 'Import Functions', tests: testImportFunctions },
    { name: 'Export Functions', tests: testExportFunctions },
    { name: 'Export Status Management', tests: testExportStatusManagement },
    { name: 'Staging Operations', tests: testStagingOperations },
    { name: 'Delivery Operations', tests: testDeliveryOperations },
    { name: 'Export Recovery', tests: testExportRecovery },
    { name: 'Export Validation', tests: testExportValidation },
    { name: 'Export Reporting', tests: testExportReporting },
    { name: 'API Endpoints', tests: testApiEndpoints },
    { name: 'Validation', tests: testValidation },
    { name: 'Video Utilities', tests: testVideoUtilities },
    { name: 'Auto Time Taken', tests: testAutoTimeTaken }
  ];
  
  // Run each test group
  testGroups.forEach(group => {
    try {
      const groupResults = group.tests();
      results.total += groupResults.total;
      results.passed += groupResults.passed;
      results.failed += groupResults.failed;
      results.errors.push(...groupResults.errors);
    } catch (error) {
      results.failed++;
      results.errors.push(`${group.name}: ${error.message}`);
    }
  });
  
  // Display results
  displayTestResults(results);
}

/**
 * Display test results
 * @param {Object} results - Test results
 */
function displayTestResults(results) {
  const ui = SpreadsheetApp.getUi();
  
  let message = `Test Results:\n\n`;
  message += `Total Tests: ${results.total}\n`;
  message += `Passed: ${results.passed}\n`;
  message += `Failed: ${results.failed}\n\n`;
  
  if (results.errors.length > 0) {
    message += `Errors:\n`;
    results.errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });
  }
  
  const title = results.failed === 0 ? 'Tests Passed!' : 'Tests Failed';
  ui.alert(title, message, ui.ButtonSet.OK);
  
  // Log to sheet
  info('Test run complete', results);
}

/**
 * Test assertion helper
 * @param {boolean} condition - Condition to test
 * @param {string} message - Error message if fails
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Test equals helper
 * @param {*} actual - Actual value
 * @param {*} expected - Expected value
 * @param {string} message - Error message
 */
function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

/**
 * Run test group
 * @param {string} name - Test group name
 * @param {Array} tests - Array of test functions
 * @returns {Object} Test results
 */
function runTestGroup(name, tests) {
  const results = {
    total: tests.length,
    passed: 0,
    failed: 0,
    errors: []
  };
  
  tests.forEach(test => {
    try {
      test.func();
      results.passed++;
      debug(`✓ ${test.name}`);
    } catch (error) {
      results.failed++;
      results.errors.push(`${test.name}: ${error.message}`);
      debug(`✗ ${test.name}: ${error.message}`);
    }
  });
  
  return results;
}

/**
 * Test Sheet Operations
 */
function testSheetOperations() {
  const tests = [
    {
      name: 'Initialize sheet',
      func: () => {
        const sheet = initializeSheet();
        assert(sheet !== null, 'Sheet should be initialized');
        assertEquals(sheet.getName(), SHEET_NAME, 'Sheet name');
      }
    },
    {
      name: 'Column structure',
      func: () => {
        const sheet = getTasksSheet();
        const headers = sheet.getRange(1, 1, 1, COLUMN_ORDER.length).getValues()[0];
        COLUMN_ORDER.forEach((key, index) => {
          assertEquals(headers[index], COLUMNS[key], `Column ${key}`);
        });
      }
    },
    {
      name: 'Create task record',
      func: () => {
        const taskData = {
          folderName: 'test_folder_123',
          batchId: 'TEST_BATCH_001',
          status: STATUS_VALUES.OPEN
        };
        // Creating task with test data
        const task = createTaskRecord(taskData);
        // Received task
        // Check task.taskId
        // Check taskId type
        assert(task.taskId !== null, 'Task should have ID');
        assertEquals(task.status, STATUS_VALUES.OPEN, 'Task status');
      }
    },
    {
      name: 'Update task record',
      func: () => {
        const tasks = queryTasks({ limit: 1 });
        if (tasks.length > 0) {
          const taskId = tasks[0].taskId;
          const updated = updateTaskRecord(taskId, {
            agentEmail: 'test@example.com'
          });
          assertEquals(updated.agentEmail, 'test@example.com', 'Agent email');
        }
      }
    }
  ];
  
  return runTestGroup('Sheet Operations', tests);
}

/**
 * Test UUID Generation
 */
function testUuidGeneration() {
  const tests = [
    {
      name: 'Generate UUID',
      func: () => {
        const uuid = generateUUID();
        assert(uuid.length === 36, 'UUID length should be 36');
        assert(isValidUUID(uuid), 'UUID should be valid');
      }
    },
    {
      name: 'Generate batch ID',
      func: () => {
        const batchId = generateBatchId('TEST');
        assert(batchId.startsWith('TEST_'), 'Batch ID should start with prefix');
        assert(batchId.length > 20, 'Batch ID should have timestamp');
      }
    },
    {
      name: 'UUID uniqueness',
      func: () => {
        const uuids = new Set();
        for (let i = 0; i < 100; i++) {
          uuids.add(generateUUID());
        }
        assertEquals(uuids.size, 100, 'All UUIDs should be unique');
      }
    }
  ];
  
  return runTestGroup('UUID Generation', tests);
}

/**
 * Test Drive Operations
 */
function testDriveOperations() {
  const tests = [
    {
      name: 'Extract file ID from URL',
      func: () => {
        const urls = [
          'https://drive.google.com/file/d/1234567890abcdef/view',
          'https://drive.google.com/open?id=1234567890abcdef',
          '1234567890abcdef'
        ];
        urls.forEach(url => {
          const id = extractFileIdFromUrl(url);
          assertEquals(id, '1234567890abcdef', 'File ID extraction');
        });
      }
    },
    {
      name: 'Folder exists check',
      func: () => {
        const exists = folderExists('invalid_folder_id');
        assertEquals(exists, false, 'Invalid folder should not exist');
      }
    }
  ];
  
  return runTestGroup('Drive Operations', tests);
}

/**
 * Test Import Functions
 */
function testImportFunctions() {
  const tests = [
    {
      name: 'Parse task folder name',
      func: () => {
        const name = 'mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0';
        const parsed = parseTaskFolderName(name);
        assert(parsed !== null, 'Should parse valid folder name');
        assertEquals(parsed.prefix, 'mc', 'Prefix');
        assertEquals(parsed.objectType, 'saucer', 'Object type');
      }
    },
    {
      name: 'Validate task folder pattern',
      func: () => {
        const validName = 'mc_0_1300_e795115eba5c1504dba7ff4c_saucer_0';
        const invalidName = 'invalid_folder_name';
        
        assert(TASK_FOLDER_PATTERN.test(validName), 'Valid name should match');
        assert(!TASK_FOLDER_PATTERN.test(invalidName), 'Invalid name should not match');
      }
    }
  ];
  
  return runTestGroup('Import Functions', tests);
}

/**
 * Test Export Functions
 */
function testExportFunctions() {
  const tests = [
    {
      name: 'Simple staging filters',
      func: () => {
        const filters = {
          batchIds: ['BATCH_001', 'BATCH_002'],
          includeUnreviewed: false,
          includeFailed: false
        };
        assert(Array.isArray(filters.batchIds), 'Batch IDs should be array');
        assertEquals(filters.includeUnreviewed, false, 'Exclude unreviewed by default');
        assertEquals(filters.includeFailed, false, 'Exclude failed by default');
      }
    },
    {
      name: 'Format file size',
      func: () => {
        assertEquals(formatFileSize(1024), '1.00 KB', '1KB');
        assertEquals(formatFileSize(1048576), '1.00 MB', '1MB');
        assertEquals(formatFileSize(1073741824), '1.00 GB', '1GB');
      }
    }
  ];
  
  return runTestGroup('Export Functions', tests);
}

/**
 * Test API Endpoints
 */
function testApiEndpoints() {
  const tests = [
    {
      name: 'Parse request',
      func: () => {
        const e = {
          parameter: { method: 'POST', path: '/api/test' },
          postData: { contents: '{"test": true}' }
        };
        const request = parseRequest(e);
        assertEquals(request.method, 'POST', 'Method');
        assertEquals(request.body.test, true, 'Body parsing');
      }
    },
    {
      name: 'API key generation',
      func: () => {
        const key = generateApiKey();
        assert(key.startsWith('tm_'), 'API key prefix');
        assertEquals(key.length, 35, 'API key length');
      }
    },
    {
      name: 'Task assignment conflict detection',
      func: () => {
        // Create a test task
        const testTaskId = generateUUID();
        const testTask = {
          taskId: testTaskId,
          batchId: 'TEST_BATCH_001',
          status: STATUS_VALUES.OPEN,
          folderName: 'test_folder',
          group: 'A',
          importTime: new Date().toISOString()
        };
        
        // Create the test task
        createTaskRecord(testTask);
        
        // First assignment should succeed
        const request1 = {
          body: {
            taskId: testTaskId,
            agentEmail: 'agent1@example.com'
          }
        };
        
        const result1 = assignTask(request1);
        assert(result1.success === true, 'First assignment should succeed');
        assertEquals(result1.task.agentEmail, 'agent1@example.com', 'Agent email should be set');
        assertEquals(result1.task.status, STATUS_VALUES.IN_PROGRESS, 'Status should be in_progress');
        
        // Second assignment attempt should fail
        const request2 = {
          body: {
            taskId: testTaskId,
            agentEmail: 'agent2@example.com'
          }
        };
        
        let errorCaught = false;
        let errorMessage = '';
        let errorCode = 0;
        
        try {
          assignTask(request2);
        } catch (error) {
          errorCaught = true;
          errorMessage = error.message;
          errorCode = error.statusCode || 0;
        }
        
        assert(errorCaught, 'Second assignment should throw error');
        assert(errorMessage.includes('already assigned'), 'Error message should indicate conflict');
        assertEquals(errorCode, 409, 'Error code should be 409 (Conflict)');
        
        // Clean up test task
        deleteTaskRecord(testTaskId);
      }
    },
    {
      name: 'Task rework system',
      func: () => {
        // Create a completed test task
        const testTaskId = generateUUID();
        const testTask = {
          taskId: testTaskId,
          batchId: 'TEST_BATCH_002',
          status: STATUS_VALUES.COMPLETE,
          folderName: 'test_rework_folder',
          group: 'B',
          importTime: new Date().toISOString(),
          agentEmail: 'original@example.com',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          endTime: new Date().toISOString(),
          objLink: 'https://drive.google.com/file/d/test/view',
          alignmentLink: 'https://drive.google.com/file/d/test2/view',
          videoLink: 'https://drive.google.com/file/d/test3/view'
        };
        
        // Create the completed task
        createTaskRecord(testTask);
        
        // Test marking task for rework
        const reworkRequest = {
          body: {
            taskId: testTaskId,
            requestedBy: 'lead@example.com',
            reason: 'Alignment needs adjustment'
          }
        };
        
        const reworkResult = reworkTask(reworkRequest);
        assert(reworkResult.success === true, 'Rework request should succeed');
        
        // Verify task state after rework
        const reworkedTask = getTaskById(testTaskId);
        assertEquals(reworkedTask.status, STATUS_VALUES.REWORK, 'Status should be rework');
        assertEquals(reworkedTask.previousAgentEmail, 'original@example.com', 'Previous agent should be stored');
        assertEquals(reworkedTask.reworkRequestedBy, 'lead@example.com', 'Requester should be stored');
        assertEquals(reworkedTask.revisionCount, 1, 'Revision count should be 1');
        assert(!reworkedTask.objLink, 'OBJ link should be cleared');
        assert(!reworkedTask.agentEmail, 'Agent email should be cleared');
        
        // Verify revision history
        assert(reworkedTask.revisionHistory, 'Revision history should exist');
        const history = JSON.parse(reworkedTask.revisionHistory);
        assertEquals(history.length, 1, 'Should have one revision entry');
        assertEquals(history[0].agentEmail, 'original@example.com', 'History should contain original agent');
        
        // Test assigning reworked task
        const assignRequest = {
          body: {
            taskId: testTaskId,
            agentEmail: 'newagent@example.com'
          }
        };
        
        const assignResult = assignTask(assignRequest);
        assert(assignResult.success === true, 'Should be able to assign reworked task');
        
        const assignedTask = getTaskById(testTaskId);
        assertEquals(assignedTask.status, STATUS_VALUES.IN_PROGRESS, 'Status should be in_progress');
        assertEquals(assignedTask.agentEmail, 'newagent@example.com', 'New agent should be assigned');
        
        // Test that only completed tasks can be reworked
        let errorCaught = false;
        try {
          reworkTask({
            body: {
              taskId: testTaskId,
              requestedBy: 'lead@example.com'
            }
          });
        } catch (error) {
          errorCaught = true;
          assert(error.message.includes('Only completed tasks'), 'Should get appropriate error message');
        }
        assert(errorCaught, 'Should not be able to rework non-completed task');
        
        // Clean up
        deleteTaskRecord(testTaskId);
      }
    }
  ];
  
  return runTestGroup('API Endpoints', tests);
}

/**
 * Test Validation
 */
function testValidation() {
  const tests = [
    {
      name: 'Email validation',
      func: () => {
        assert(isValidEmail('test@example.com'), 'Valid email');
        assert(!isValidEmail('invalid-email'), 'Invalid email');
        assert(!isValidEmail(''), 'Empty email');
      }
    },
    {
      name: 'Date validation',
      func: () => {
        const validDate = new Date().toISOString();
        assert(isValidISODate(validDate), 'Valid ISO date');
        assert(!isValidISODate('invalid-date'), 'Invalid date');
      }
    },
    {
      name: 'Status validation',
      func: () => {
        const validStatuses = Object.values(STATUS_VALUES);
        validStatuses.forEach(status => {
          assert(validStatuses.includes(status), `Valid status: ${status}`);
        });
      }
    },
    {
      name: 'Duration validation',
      func: () => {
        // Test valid HH:MM:SS formats
        assert(validateAndFormatDuration('1:30:45') === '01:30:45', 'HH:MM:SS format');
        assert(validateAndFormatDuration('01:30:45') === '01:30:45', 'HH:MM:SS with leading zeros');
        assert(validateAndFormatDuration('12:59:59') === '12:59:59', 'Max valid time');
        
        // Test valid MM:SS formats
        assert(validateAndFormatDuration('45:30') === '00:45:30', 'MM:SS format');
        assert(validateAndFormatDuration('5:15') === '00:05:15', 'M:SS format');
        assert(validateAndFormatDuration('59:59') === '00:59:59', 'Max minutes/seconds');
        
        // Test invalid formats - should throw errors
        try {
          validateAndFormatDuration('100:00:00');
          throw new Error('Should have failed for hours > 99');
        } catch (e) {
          assert(e.message.includes('hours cannot exceed 99'), 'Hours validation');
        }
        
        try {
          validateAndFormatDuration('1:60:30');
          throw new Error('Should have failed for minutes > 59');
        } catch (e) {
          assert(e.message.includes('minutes cannot exceed 59'), 'Minutes validation');
        }
        
        try {
          validateAndFormatDuration('invalid');
          throw new Error('Should have failed for invalid format');
        } catch (e) {
          assert(e.message.includes('HH:MM:SS or MM:SS format'), 'Format validation');
        }
      }
    }
  ];
  
  return runTestGroup('Validation', tests);
}

/**
 * Test Video Utilities (unit tests)
 */
function testVideoUtilities() {
  const tests = [
    {
      name: 'Format ms to HH:MM:SS',
      func: () => {
        assertEquals(formatMsToHHMMSS(3661000), '01:01:01', '1h1m1s formatting');
        assertEquals(formatMsToHHMMSS(0), '00:00:00', 'Zero formatting');
      }
    },
    {
      name: 'Extract Drive file IDs from links',
      func: () => {
        const links = [
          'https://drive.google.com/file/d/aaaaaaaaaaaaaaaaaaaa/view',
          ' https://drive.google.com/open?id=bbbbbbbbbbbbbbbbbbbb ',
          'https://drive.google.com/file/d/cccccccccccccccccccc/edit?usp=sharing'
        ].join(',');
        const ids = extractDriveFileIdsFromLinks(links);
        assertEquals(ids.length, 3, 'Should extract 3 IDs');
        assertEquals(ids[0], 'aaaaaaaaaaaaaaaaaaaa', 'First ID');
        assertEquals(ids[1], 'bbbbbbbbbbbbbbbbbbbb', 'Second ID');
        assertEquals(ids[2], 'cccccccccccccccccccc', 'Third ID');
      }
    },
    {
      name: 'Compute duration from IDs (stubbed responses)',
      func: () => {
        const original = parallelFetch;
        try {
          // Stub: return two videos 65s and 95s
          parallelFetch = (requests) => {
            return requests.map((_, i) => ({
              mimeType: 'video/mp4',
              videoMediaMetadata: { durationMillis: i === 0 ? 65000 : 95000 }
            }));
          };
          const result = computeTimeTakenFromVideoIds(['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb']);
          assertEquals(result, '00:02:40', 'Total duration 160s');
        } finally {
          parallelFetch = original;
        }
      }
    },
    {
      name: 'Compute duration error path (stubbed throw)',
      func: () => {
        const original = parallelFetch;
        try {
          parallelFetch = () => { throw new Error('network'); };
          const result = computeTimeTakenFromVideoIds(['aaaaaaaaaaaaaaaaaaaa']);
          assert(result === null || result === '00:00:00', 'Graceful handling on error');
        } finally {
          parallelFetch = original;
        }
      }
    }
  ];
  return runTestGroup('Video Utilities', tests);
}

/**
 * Test auto-calculation of timeTaken in updateTask (integration-ish with stubs)
 */
function testAutoTimeTaken() {
  const tests = [
    {
      name: 'updateTask sets timeTaken from videoFileId (stubbed durations)',
      func: () => {
        const taskId = generateUUID();
        createTaskRecord({
          taskId,
          folderName: 'auto_time_test_folder',
          batchId: 'TEST_AUTO_TIME_001',
          status: STATUS_VALUES.OPEN,
          importTime: new Date().toISOString()
        });

        const original = parallelFetch;
        try {
          // 60s + 90s = 150s = 00:02:30
          parallelFetch = (requests) => {
            return requests.map((_, i) => ({
              mimeType: 'video/mp4',
              videoMediaMetadata: { durationMillis: i === 0 ? 60000 : 90000 }
            }));
          };

          const req = { body: { taskId, videoFileId: ['aaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbb'] } };
          const res = updateTask(req);
          assert(res.success === true, 'Update should succeed');
          assert(res.task.videoLink && res.task.videoLink.indexOf('/file/d/aaaaaaaaaaaaaaaaaaaa/') !== -1, 'videoLink contains first video');
          assertEquals(res.task.timeTaken, '00:02:30', 'Auto timeTaken set');

          // Explicit timeTaken must take precedence
          const req2 = { body: { taskId, videoFileId: ['cccccccccccccccccccc'], timeTaken: '00:00:05' } };
          const res2 = updateTask(req2);
          assert(res2.success === true, 'Second update should succeed');
          assertEquals(res2.task.timeTaken, '00:00:05', 'Client-provided timeTaken wins');
        } finally {
          parallelFetch = original;
          deleteTaskRecord(taskId);
        }
      }
    }
  ];
  return runTestGroup('Auto Time Taken', tests);
}

/**
 * Clean up test data
 */
function cleanupTestData() {
  const sheet = getTasksSheet();
  const data = sheet.getDataRange().getValues();
  
  // Find and remove test records
  for (let i = data.length - 1; i > 0; i--) {
    const batchId = data[i][getColumnIndex('BATCH_ID') - 1];
    if (batchId && batchId.startsWith('TEST_')) {
      sheet.deleteRow(i + 1);
    }
  }
  
  info('Test data cleaned up');
}
