/**
 * API authentication and authorization
 * Handles API key validation and request authentication
 */

/**
 * Validate API key
 * @param {Object} request - Request object
 * @throws {ApiError} If authentication fails
 */
function validateApiKey(request) {
  const apiKey = request.headers['X-API-Key'] || 
                 request.params.apiKey || 
                 request.body?.apiKey;
  
  if (!apiKey) {
    throw new ApiError('API key required', 401);
  }
  
  const validKey = getValidApiKey();
  
  if (apiKey !== validKey) {
    throw new ApiError('Invalid API key', 401);
  }
  
  // Log API access
  info('API request authenticated', {
    method: request.method,
    path: request.path,
    timestamp: new Date().toISOString()
  });
}

/**
 * Get valid API key from properties
 * @returns {string} Valid API key
 */
function getValidApiKey() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let apiKey = scriptProperties.getProperty('API_KEY');
  
  if (!apiKey) {
    // Generate and store new API key
    apiKey = generateApiKey();
    scriptProperties.setProperty('API_KEY', apiKey);
    info('Generated new API key');
  }
  
  return apiKey;
}

/**
 * Generate new API key
 * @returns {string} Generated API key
 */
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'tm_'; // prefix for identification
  
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return key;
}

/**
 * Rotate API key
 * @returns {string} New API key
 */
function rotateApiKey() {
  const newKey = generateApiKey();
  const scriptProperties = PropertiesService.getScriptProperties();
  
  // Store old key temporarily for graceful transition
  const currentKey = scriptProperties.getProperty('API_KEY');
  if (currentKey) {
    scriptProperties.setProperty('OLD_API_KEY', currentKey);
    scriptProperties.setProperty('KEY_ROTATION_TIME', new Date().toISOString());
  }
  
  scriptProperties.setProperty('API_KEY', newKey);
  
  info('API key rotated', {
    timestamp: new Date().toISOString()
  });
  
  return newKey;
}

/**
 * Show current API key (for admin use)
 * @returns {Object} API key info
 */
function showApiKey() {
  const ui = SpreadsheetApp.getUi();
  const apiKey = getValidApiKey();
  
  ui.alert(
    'API Key',
    `Current API Key: ${apiKey}\n\nKeep this key secure and only share with authorized applications.`,
    ui.ButtonSet.OK
  );
  
  return {
    key: apiKey,
    created: PropertiesService.getScriptProperties().getProperty('KEY_ROTATION_TIME') || 'Unknown'
  };
}

/**
 * Validate request origin
 * @param {Object} request - Request object
 * @returns {boolean} True if valid origin
 */
function validateOrigin(request) {
  const allowedOrigins = getallowedOrigins();
  const origin = request.headers['Origin'] || request.headers['origin'];
  
  if (!origin) {
    return true; // No origin header, likely server-to-server
  }
  
  return allowedOrigins.includes(origin);
}

/**
 * Get allowed origins
 * @returns {Array<string>} Allowed origins
 */
function getallowedOrigins() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const origins = scriptProperties.getProperty('ALLOWED_ORIGINS');
  
  if (!origins) {
    return ['*']; // Allow all by default
  }
  
  return origins.split(',').map(o => o.trim());
}

/**
 * Add allowed origin
 * @param {string} origin - Origin to allow
 */
function addAllowedOrigin(origin) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const current = getallowedOrigins();
  
  if (!current.includes(origin)) {
    current.push(origin);
    scriptProperties.setProperty('ALLOWED_ORIGINS', current.join(','));
    
    info('Added allowed origin', { origin });
  }
}

/**
 * Create CORS headers
 * @param {Object} request - Request object
 * @returns {Object} CORS headers
 */
function createCorsHeaders(request) {
  const origin = request.headers['Origin'] || request.headers['origin'] || '*';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Max-Age': '86400'
  };
}