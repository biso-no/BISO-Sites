/**
 * MIME type utilities for correcting misidentified file types
 */

/**
 * Get correct MIME type based on file extension
 */
export function getMimeTypeFromExtension(filename: string): string | null {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const mimeMap: Record<string, string> = {
      // Microsoft Office formats
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt': 'application/vnd.ms-powerpoint',
      
      // Other document formats
      'pdf': 'application/pdf',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'html': 'text/html',
      'htm': 'text/html',
      'xml': 'application/xml',
      'json': 'application/json',
    };
    
    return ext ? mimeMap[ext] || null : null;
  }
  
  /**
   * Correct MIME type if it's generic or incorrect
   * Falls back to file extension-based detection
   */
  export function correctMimeType(mimeType: string, filename: string): string {
    const genericTypes = [
      'application/octet-stream',
      'application/zip',
      'application/x-zip-compressed',
      'binary/octet-stream',
    ];
    
    // If MIME type is generic or missing, try to detect from extension
    if (!mimeType || genericTypes.includes(mimeType.toLowerCase())) {
      const correctedType = getMimeTypeFromExtension(filename);
      if (correctedType) {
        console.log(`Corrected MIME type for ${filename}: ${mimeType} → ${correctedType}`);
        return correctedType;
      }
    }
    
    // Special case: DOCX/XLSX/PPTX sometimes identified as zip
    if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') {
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
        const correctedType = getMimeTypeFromExtension(filename);
        if (correctedType) {
          console.log(`Corrected MIME type for ${filename}: ${mimeType} → ${correctedType}`);
          return correctedType;
        }
      }
    }
    
    return mimeType;
  }
  
  /**
   * Check if a file should be processed based on extension
   * (as a fallback when MIME type is unreliable)
   */
  export function isSupportedFileExtension(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    const supportedExtensions = [
      'pdf',
      'doc', 'docx',
      'xls', 'xlsx',
      'ppt', 'pptx',
      'csv',
      'txt', 'md',
      'html', 'htm',
    ];
    
    return ext ? supportedExtensions.includes(ext) : false;
  }