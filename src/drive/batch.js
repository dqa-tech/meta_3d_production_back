/**
 * Drive batch operations
 * High-performance batch processing for Google Drive API v3
 */

/**
 * Execute batch operations using Drive API v3
 * @param {Array} requests - Array of request objects
 * @returns {Array} Array of responses
 */
function executeDriveBatch(requests) {
  if (!requests || requests.length === 0) {
    return [];
  }
  
  const batchSize = 100; // Google's limit per batch
  const results = [];
  
  // Process in chunks of 100
  for (let i = 0; i < requests.length; i += batchSize) {
    const chunk = requests.slice(i, i + batchSize);
    const batchResults = executeBatchChunk(chunk);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Execute a single batch chunk
 * @param {Array} requests - Batch requests (max 100)
 * @returns {Array} Batch responses
 */
function executeBatchChunk(requests) {
  const boundary = '-------314159265358979323846';
  const delimiter = '\r\n--' + boundary + '\r\n';
  const closeDelimiter = '\r\n--' + boundary + '--';
  
  // Build multipart batch request body
  let batchBody = '';
  
  requests.forEach((request, index) => {
    batchBody += delimiter;
    batchBody += 'Content-Type: application/http\r\n';
    batchBody += 'Content-ID: ' + (index + 1) + '\r\n\r\n';
    
    batchBody += request.method + ' ' + request.path + ' HTTP/1.1\r\n';
    batchBody += 'Content-Type: application/json\r\n\r\n';
    
    if (request.body) {
      batchBody += JSON.stringify(request.body);
    }
  });
  
  batchBody += closeDelimiter;
  
  // Execute batch request
  console.log('Sending batch request to:', 'https://www.googleapis.com/batch/drive/v3');
  console.log('Batch body preview:', batchBody.substring(0, 500));
  
  const response = UrlFetchApp.fetch('https://www.googleapis.com/batch/drive/v3', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Type': 'multipart/mixed; boundary=' + boundary
    },
    payload: batchBody,
    muteHttpExceptions: true
  });
  
  // Log response status for debugging
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  
  console.log('Batch API response code:', responseCode);
  console.log('Batch API response preview:', responseText.substring(0, 500));
  
  if (responseCode !== 200) {
    warn('Batch API returned non-200 status', {
      code: responseCode,
      body: responseText.substring(0, 500)
    });
  }
  
  // Parse multipart response
  const parsed = parseBatchResponse(responseText);
  console.log('Parsed batch response:', parsed);
  return parsed;
}

/**
 * Parse multipart batch response
 * @param {string} responseText - Raw response text
 * @returns {Array} Parsed responses
 */
function parseBatchResponse(responseText) {
  // The response uses a different boundary than our request
  // Extract the actual boundary - it may have leading whitespace/newlines
  const actualBoundaryMatch = responseText.match(/--([a-zA-Z0-9_-]+)/);
  if (!actualBoundaryMatch) {
    console.log('Could not find boundary in response');
    console.log('Response start:', responseText.substring(0, 100));
    return [];
  }
  
  const responseBoundary = actualBoundaryMatch[1];
  console.log('Response boundary:', responseBoundary);
  
  // Split by the response boundary
  const parts = responseText.split('--' + responseBoundary);
  const responses = [];
  
  console.log('Found', parts.length - 1, 'parts in response');
  
  // Process each part (skip first empty and last closing)
  for (let i = 1; i < parts.length - 1; i++) {
    const part = parts[i];
    
    // Find the JSON content - it's after a blank line
    // Look for the pattern: Content-Length: XXX\n\n{json}
    const jsonMatch = part.match(/Content-Length: \d+\s*\n\s*\n\s*(\{[\s\S]*?\})\s*$/);
    
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        responses.push(parsed);
        console.log('Parsed folder', i, ':', parsed.name, 'id:', parsed.id);
      } catch (e) {
        console.log('Failed to parse JSON in part', i, ':', e.toString());
      }
    } else {
      // Try simpler approach - find the JSON object
      const simpleMatch = part.match(/\{[\s\S]*"id"[\s\S]*?\}/);
      if (simpleMatch) {
        try {
          const parsed = JSON.parse(simpleMatch[0]);
          responses.push(parsed);
          console.log('Parsed folder', i, ':', parsed.name, 'id:', parsed.id);
        } catch (e) {
          console.log('Failed to parse JSON in part', i);
        }
      }
    }
  }
  
  console.log('Successfully parsed', responses.length, 'responses');
  return responses;
}

/**
 * Batch create folders
 * @param {string} parentId - Parent folder ID
 * @param {Array<string>} folderNames - Folder names to create
 * @returns {Array} Created folder objects
 */
function batchCreateFolders(parentId, folderNames) {
  console.log('batchCreateFolders called with:', folderNames.length, 'folders');
  
  const requests = folderNames.map(name => ({
    method: 'POST',
    path: '/drive/v3/files',
    body: {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    }
  }));
  
  const result = executeDriveBatch(requests);
  console.log('batchCreateFolders result:', result);
  return result;
}

/**
 * Batch copy files
 * @param {Array} fileMappings - Array of {fileId, targetFolderId, newName}
 * @returns {Array} Copied file objects
 */
function batchCopyFiles(fileMappings) {
  const requests = fileMappings.map(mapping => ({
    method: 'POST',
    path: `/drive/v3/files/${mapping.fileId}/copy`,
    body: {
      name: mapping.newName,
      parents: [mapping.targetFolderId]
    }
  }));
  
  return executeDriveBatch(requests);
}

/**
 * Batch get file metadata
 * @param {Array<string>} fileIds - File IDs
 * @returns {Array} File metadata objects
 */
function batchGetMetadata(fileIds) {
  const requests = fileIds.map(id => ({
    method: 'GET',
    path: `/drive/v3/files/${id}?fields=id,name,mimeType,parents,webViewLink`,
    body: null
  }));
  
  return executeDriveBatch(requests);
}

/**
 * Bulk list files in folder with pagination
 * @param {string} parentId - Parent folder ID
 * @param {Object} options - Query options
 * @returns {Array} All files matching criteria
 */
function bulkListFiles(parentId, options = {}) {
  const mimeType = options.mimeType || null;
  const pageSize = 1000; // Maximum allowed
  
  let query = `'${parentId}' in parents and trashed = false`;
  if (mimeType) {
    query += ` and mimeType = '${mimeType}'`;
  }
  
  const allFiles = [];
  let pageToken = null;
  
  do {
    const params = {
      q: query,
      pageSize: pageSize,
      fields: 'nextPageToken, files(id, name, mimeType, parents, webViewLink)',
      supportsAllDrives: true
    };
    
    if (pageToken) {
      params.pageToken = pageToken;
    }
    
    const response = Drive.Files.list(params);
    allFiles.push(...response.files);
    pageToken = response.nextPageToken;
  } while (pageToken);
  
  return allFiles;
}

/**
 * Parallel fetch using UrlFetchApp.fetchAll
 * @param {Array} requests - Array of request configurations
 * @returns {Array} Response objects
 */
function parallelFetch(requests) {
  const urlFetchRequests = requests.map(req => ({
    url: `https://www.googleapis.com/drive/v3${req.path}`,
    method: req.method || 'GET',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Type': 'application/json'
    },
    payload: req.body ? JSON.stringify(req.body) : null,
    muteHttpExceptions: true
  }));
  
  const responses = UrlFetchApp.fetchAll(urlFetchRequests);
  
  return responses.map(response => {
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return JSON.parse(response.getContentText());
    } else {
      return { 
        error: `HTTP ${code}`,
        message: response.getContentText()
      };
    }
  });
}