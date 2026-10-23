import { MEDIA_BUCKET_ID } from "@repo/api/storage";
import {
  DEFAULT_UPLOAD_BUCKET,
  IMAGE_MAX_BYTES,
  maxBytesForMime,
  mimeFromFilename,
  resolveUploadBucket,
} from "./upload-buckets";

export type UploadResult =
  | { error?: never; fileId: string; url: string }
  | { error: string; fileId?: never; url?: never };

/** The largest image `/api/upload` takes; documents may be larger. */
export const MAX_UPLOAD_BYTES = IMAGE_MAX_BYTES;

/**
 * Browser-side upload through `/api/upload`. Never throws: network failures,
 * proxy errors and non-JSON responses are all returned as `{ error }` so
 * callers can always clear their "uploading" state.
 */
export async function uploadFile(
  file: File,
  options: { bucket?: string } = {}
): Promise<UploadResult> {
  // Some browsers leave a document's type empty; the route needs one.
  const mimeType = file.type || mimeFromFilename(file.name) || "";
  // The same per-type limit the route enforces. An unknown bucket or type is
  // left to the route to refuse with its own message.
  const bucket = resolveUploadBucket(options.bucket ?? DEFAULT_UPLOAD_BUCKET);
  const limit = bucket ? maxBytesForMime(bucket, mimeType) : null;
  if (limit !== null && file.size > limit) {
    return { error: `File too large (max ${limit / 1024 / 1024} MB)` };
  }

  const url = options.bucket
    ? `/api/upload?bucket=${encodeURIComponent(options.bucket)}`
    : "/api/upload";

  try {
    const response = await fetch(url, {
      body: file,
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        // Header values must be Latin-1; the route decodes this.
        "x-filename": encodeURIComponent(file.name),
      },
      method: "POST",
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      fileId?: string;
      url?: string;
    } | null;

    if (!(response.ok && body?.fileId && body.url)) {
      if (response.status === 401) {
        return { error: "Your session has expired. Sign in and try again." };
      }
      return {
        error: body?.error ?? `Upload failed (HTTP ${response.status})`,
      };
    }
    return { fileId: body.fileId, url: body.url };
  } catch {
    return {
      error: "Upload failed — check your connection and try again.",
    };
  }
}

/** Public images (cover images, page/news media) go to the `media` bucket. */
export function uploadMediaFile(file: File): Promise<UploadResult> {
  return uploadFile(file, { bucket: MEDIA_BUCKET_ID });
}
