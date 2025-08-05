/**
 * UUID generation utility
 * Generates RFC4122 v4 compliant UUIDs
 */

/**
 * Generate a UUID v4
 * @returns {string} UUID string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate a batch ID with timestamp
 * @param {string} prefix - Optional prefix for the batch ID
 * @returns {string} Batch ID
 */
function generateBatchId(prefix = 'BATCH') {
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .split('.')[0];
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Generate a short task ID
 * @returns {string} 8-character task ID
 */
function generateShortId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Validate UUID format
 * @param {string} uuid - UUID to validate
 * @returns {boolean} True if valid UUID
 */
function isValidUUID(uuid) {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return pattern.test(uuid);
}