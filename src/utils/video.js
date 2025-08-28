/**
 * Video utilities
 * Helpers to extract Drive file IDs from links and compute total duration
 */

/**
 * Extract Google Drive file IDs from a comma-separated list of links
 * @param {string} links - Comma-separated Drive links
 * @returns {Array<string>} Array of file IDs
 */
function extractDriveFileIdsFromLinks(links) {
  if (!links || typeof links !== 'string') return [];
  const ids = [];
  links.split(',').forEach(part => {
    const link = String(part).trim();
    // Match /file/d/{id}/ or open?id={id}
    let match = link.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
    if (match && match[1]) {
      ids.push(match[1]);
      return;
    }
    match = link.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (match && match[1]) {
      ids.push(match[1]);
    }
  });
  return ids;
}

/**
 * Format milliseconds into HH:MM:SS string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} HH:MM:SS
 */
function formatMsToHHMMSS(ms) {
  if (!ms || ms < 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    String(hours).padStart(2, '0') + ':' +
    String(minutes).padStart(2, '0') + ':' +
    String(seconds).padStart(2, '0')
  );
}

/**
 * Batch-fetch video durations for Drive file IDs using Drive API v3
 * Requires Advanced Drive Service or OAuth token with Drive scope.
 * @param {Array<string>} fileIds - Array of Drive file IDs
 * @returns {number} Total duration in milliseconds
 */
function getTotalVideoDurationMsFromIds(fileIds) {
  if (!Array.isArray(fileIds) || fileIds.length === 0) return 0;
  try {
    const requests = fileIds.map(id => ({
      method: 'GET',
      path: `/drive/v3/files/${id}?supportsAllDrives=true&fields=id,mimeType,videoMediaMetadata(durationMillis)`,
      body: null
    }));
    const responses = parallelFetch(requests);
    let total = 0;
    responses.forEach(resp => {
      if (!resp || resp.error) return; // skip errors
      // Only sum durations for video files where metadata exists
      const isVideo = resp.mimeType && resp.mimeType.indexOf('video/') === 0;
      const duration = resp.videoMediaMetadata && resp.videoMediaMetadata.durationMillis;
      if (isVideo && typeof duration === 'number' && duration > 0) {
        total += duration;
      }
    });
    return total;
  } catch (e) {
    // Log and fall back to 0
    error('Failed to fetch video durations', { message: e.message });
    return 0;
  }
}

/**
 * Convenience: Compute HH:MM:SS from Drive file IDs
 * @param {Array<string>} fileIds - Drive file IDs
 * @returns {string|null} Duration string or null if not computable
 */
function computeTimeTakenFromVideoIds(fileIds) {
  const totalMs = getTotalVideoDurationMsFromIds(fileIds);
  return totalMs > 0 ? formatMsToHHMMSS(totalMs) : null;
}

