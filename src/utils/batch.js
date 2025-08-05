/**
 * Batch operation utilities
 * Handles chunking and parallel processing
 */

const BATCH_SIZE = 50;
const MAX_PARALLEL = 5;

/**
 * Process items in batches
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {number} batchSize - Items per batch
 * @returns {Promise<Array>} Results
 */
async function processBatch(items, processor, batchSize = BATCH_SIZE) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    );
    results.push(...batchResults);
    
    // Yield to prevent timeout
    Utilities.sleep(100);
  }
  
  return results;
}

/**
 * Process items in parallel with concurrency limit
 * @param {Array} items - Items to process
 * @param {Function} processor - Async function to process each item
 * @param {number} concurrency - Max parallel operations
 * @returns {Promise<Array>} Results
 */
async function processParallel(items, processor, concurrency = MAX_PARALLEL) {
  const results = [];
  const executing = [];
  
  for (const item of items) {
    const promise = processor(item).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

/**
 * Chunk array into smaller arrays
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array<Array>} Chunked arrays
 */
function chunk(array, size = BATCH_SIZE) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise} Operation result
 */
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        Utilities.sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a progress tracker
 * @param {number} total - Total items
 * @param {Function} onUpdate - Progress update callback
 * @returns {Object} Progress tracker
 */
function createProgressTracker(total, onUpdate) {
  let completed = 0;
  
  return {
    increment() {
      completed++;
      const percentage = Math.round((completed / total) * 100);
      onUpdate({ completed, total, percentage });
    },
    
    update(count) {
      completed = count;
      const percentage = Math.round((completed / total) * 100);
      onUpdate({ completed, total, percentage });
    },
    
    getStatus() {
      return { completed, total, percentage: Math.round((completed / total) * 100) };
    }
  };
}