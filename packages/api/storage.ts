/**
 * Helper functions for working with Appwrite Storage
 */

const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";
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

/**
 * Default bucket that CMS-uploaded media (product images, hero images, …)
 * lives in.
 */
export const MEDIA_BUCKET_ID = "media";

/**
 * Appwrite file IDs are at most 36 chars of `a-z A-Z 0-9 . - _`, and may not
 * start with a special character. Anything else (a URL, a `/public` path, a
 * relative path) is not an ID.
 */
const FILE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

/**
 * Resolves a stored image reference to a URL that `next/image` can load.
 *
 * The admin CMS stores the full storage URL when an image is attached, but
 * products imported from the old website stored only the bare Appwrite file
 * ID. This accepts either: a value that already looks like a URL or a path is
 * returned untouched, a bare file ID is expanded into a storage view URL.
 *
 * @param value - The stored `image` value (URL, file ID, path, or nullish)
 * @param bucketId - Bucket the file ID belongs to, defaults to `media`
 * @returns A usable URL, or `null` when there is nothing to render
 */
export function resolveStorageFileUrl(
  value: string | null | undefined,
  bucketId: string = MEDIA_BUCKET_ID
): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  // Bare Appwrite file ID — the shape produced by the legacy import.
  if (FILE_ID_PATTERN.test(trimmed)) {
    return getStorageFileUrl(bucketId, trimmed);
  }

  // Already a URL (`https:`, `data:`, `//cdn…`) or an app-served path.
  return trimmed;
}

/**
 * List variant of {@link resolveStorageFileUrl}, dropping entries that resolve
 * to nothing.
 *
 * @param values - Stored `images` values (URLs, file IDs, or nullish)
 * @param bucketId - Bucket the file IDs belong to, defaults to `media`
 * @returns The resolved URLs
 */
export function resolveStorageFileUrls(
  values: readonly (string | null | undefined)[] | null | undefined,
  bucketId: string = MEDIA_BUCKET_ID
): string[] {
  if (!values) {
    return [];
  }

  const resolved: string[] = [];

  for (const value of values) {
    const url = resolveStorageFileUrl(value, bucketId);
    if (url) {
      resolved.push(url);
    }
  }

  return resolved;
}
