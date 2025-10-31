import { isSupportedFileExtension } from './mime-utils';

// Centralized helper to determine if a MIME type is supported for text extraction
export function isSupportedContentType(contentType: string, filename?: string): boolean {
  const ct = (contentType || '').toLowerCase();
  
  // Check MIME type
  const supportedByMime = (
    ct.includes('pdf') ||
    ct.includes('word') || ct.includes('docx') || ct === 'application/msword' ||
    ct.includes('presentation') || ct.includes('pptx') ||
    ct.includes('spreadsheet') || ct.includes('xlsx') || ct.includes('excel') || ct.includes('sheet') || ct.includes('vnd.ms-excel') ||
    ct.includes('csv') ||
    ct.includes('html') ||
    ct.includes('markdown') || ct === 'text/markdown' ||
    ct.includes('text')
  );
  
  // If MIME type is generic (zip, octet-stream), check file extension
  if (!supportedByMime && filename) {
    const genericTypes = ['application/zip', 'application/octet-stream', 'application/x-zip-compressed'];
    if (genericTypes.some(t => ct.includes(t))) {
      return isSupportedFileExtension(filename);
    }
  }
  
  return supportedByMime;
}

