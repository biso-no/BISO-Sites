/**
 * Helper functions for working with Appwrite Storage
 */

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT ||
  "https://appwrite.biso.no/v1";
const APPWRITE_PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";

/**
 * Generates a direct URL for viewing/downloading a file from Appwrite Storage
 * @param bucketId - The storage bucket ID
 * @param fileId - The file ID
 * @returns A direct URL to view the file
 */
export function getStorageFileUrl(bucketId: string, fileId: string): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/view?project=${APPWRITE_PROJECT}`;
}

/**
 * Generates a direct download URL for a file from Appwrite Storage
 * @param bucketId - The storage bucket ID
 * @param fileId - The file ID
 * @returns A direct URL to download the file
 */
export function getStorageFileDownloadUrl(
  bucketId: string,
  fileId: string
): string {
  return `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/download?project=${APPWRITE_PROJECT}`;
}

/**
 * Generates a thumbnail URL for an image file from Appwrite Storage
 * @param bucketId - The storage bucket ID
 * @param fileId - The file ID
 * @param width - Optional width in pixels
 * @param height - Optional height in pixels
 * @param quality - Optional quality (0-100)
 * @returns A direct URL to view the thumbnail
 */
export function getStorageFileThumbnailUrl(
  bucketId: string,
  fileId: string,
  options?: {
    width?: number;
    height?: number;
    quality?: number;
  }
): string {
  const params = new URLSearchParams({ project: APPWRITE_PROJECT });

  if (options?.width) {
    params.append("width", options.width.toString());
  }
  if (options?.height) {
    params.append("height", options.height.toString());
  }
  if (options?.quality) {
    params.append("quality", options.quality.toString());
  }

  return `${APPWRITE_ENDPOINT}/storage/buckets/${bucketId}/files/${fileId}/preview?${params.toString()}`;
}
