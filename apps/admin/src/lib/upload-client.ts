import { MEDIA_BUCKET_ID } from "@repo/api/storage";

export type UploadResult =
  | { error?: never; fileId: string; url: string }
  | { error: string; fileId?: never; url?: never };

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Browser-side upload through `/api/upload`. Never throws: network failures,
 * proxy errors and non-JSON responses are all returned as `{ error }` so
 * callers can always clear their "uploading" state.
 */
export async function uploadFile(
  file: File,
  options: { bucket?: string } = {}
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File too large (max 10 MB)" };
  }

  const url = options.bucket
    ? `/api/upload?bucket=${encodeURIComponent(options.bucket)}`
    : "/api/upload";

  try {
    const response = await fetch(url, {
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
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
