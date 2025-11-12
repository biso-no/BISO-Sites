/**
 * Utility functions for document handling and URL generation
 */

export interface DocumentViewerUrlOptions {
    fileName: string;
    baseUrl?: string;
  }
  
  /**
   * Generate a public document viewer URL for a SharePoint document
   * @param options - Options for generating the URL
   * @returns The full URL to the document viewer page
   */
  export function getDocumentViewerUrl(options: DocumentViewerUrlOptions): string {
    const { fileName, baseUrl = '' } = options;
    
    // URL encode the fileName to handle spaces and special characters
    const encodedFileName = encodeURIComponent(fileName);
    
    // If baseUrl is provided, use it; otherwise use relative URL
    if (baseUrl) {
      return `${baseUrl}/document/${encodedFileName}`;
    }
    
    // For server-side usage, try to get the base URL from environment
    if (typeof window === 'undefined') {
      const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || '';
      if (envBaseUrl) {
        return `${envBaseUrl}/document/${encodedFileName}`;
      }
    }
    
    // For client-side usage or when no base URL is available
    return `/document/${encodedFileName}`;
  }
  
  /**
   * Extract document ID from a SharePoint web URL or document viewer URL
   * @param url - The URL to parse
   * @returns The document ID or null if not found
   */
  export function extractDocumentId(url: string): string | null {
    // Check if it's already a document viewer URL
    const viewerMatch = url.match(/\/document\/([^\/\?]+)/);
    if (viewerMatch) {
      return viewerMatch[1];
    }
    
    // Try to extract from SharePoint URL patterns
    // Pattern 1: /sites/{site}/Shared Documents/Forms/DispForm.aspx?ID={id}
    const dispFormMatch = url.match(/DispForm\.aspx\?ID=([^&]+)/);
    if (dispFormMatch) {
      return dispFormMatch[1];
    }
    
    // Pattern 2: Direct link with item ID in path
    const itemMatch = url.match(/\/items\/([^\/\?]+)/);
    if (itemMatch) {
      return itemMatch[1];
    }
    
    return null;
  }
  
  /**
   * Determine if a content type can be rendered inline in the browser
   * @param contentType - The MIME type of the document
   * @returns True if the document can be rendered inline
   */
  export function canRenderInline(contentType: string): boolean {
    const lowerType = contentType.toLowerCase();
    
    // PDFs can be rendered inline
    if (lowerType.includes('pdf')) return true;
    
    // Images can be rendered inline
    if (lowerType.includes('image')) return true;
    
    // Text files can be rendered inline
    if (lowerType.includes('text')) return true;
    
    // HTML can be rendered inline (with caution)
    if (lowerType.includes('html')) return true;
    
    // Most other types (Office documents, etc.) need to be downloaded
    return false;
  }
  
  /**
   * Get a user-friendly document type name from MIME type
   * @param contentType - The MIME type
   * @returns A user-friendly type name
   */
  export function getDocumentTypeName(contentType: string): string {
    const lowerType = contentType.toLowerCase();
    
    if (lowerType.includes('pdf')) return 'PDF Document';
    if (lowerType.includes('word') || lowerType.includes('document')) return 'Word Document';
    if (lowerType.includes('excel') || lowerType.includes('spreadsheet')) return 'Excel Spreadsheet';
    if (lowerType.includes('powerpoint') || lowerType.includes('presentation')) return 'PowerPoint Presentation';
    if (lowerType.includes('image')) {
      if (lowerType.includes('jpeg') || lowerType.includes('jpg')) return 'JPEG Image';
      if (lowerType.includes('png')) return 'PNG Image';
      if (lowerType.includes('gif')) return 'GIF Image';
      if (lowerType.includes('svg')) return 'SVG Image';
      return 'Image';
    }
    if (lowerType.includes('text')) {
      if (lowerType.includes('plain')) return 'Text File';
      if (lowerType.includes('csv')) return 'CSV File';
      return 'Text Document';
    }
    if (lowerType.includes('video')) return 'Video File';
    if (lowerType.includes('audio')) return 'Audio File';
    if (lowerType.includes('zip') || lowerType.includes('compressed')) return 'Archive File';
    
    return 'Document';
  }
  
  /**
   * Format file size in human-readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
  
  /**
   * Create metadata for document viewer from vector store metadata
   * @param metadata - Raw metadata from vector store
   * @returns Formatted metadata for document viewer
   */
  export function formatDocumentMetadata(metadata: Record<string, any>) {
    return {
      id: metadata.documentId,
      name: metadata.documentName || 'Unknown Document',
      siteId: metadata.siteId,
      siteName: metadata.siteName || 'Unknown Site',
      driveId: metadata.driveId,
      contentType: metadata.contentType || 'application/octet-stream',
      size: metadata.fileSize || 0,
      lastModified: metadata.lastModified || new Date().toISOString(),
      createdBy: metadata.createdBy || 'Unknown',
      webUrl: metadata.webUrl,
      viewerUrl: getDocumentViewerUrl({ fileName: metadata.fileName || metadata.documentName || 'Unknown Document' }),
    };
  }