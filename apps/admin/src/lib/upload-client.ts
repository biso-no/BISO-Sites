import { CHUNK_BYTES, MEDIA_BUCKET_ID } from "@repo/api/storage";
import {
  allowsChunkedUpload,
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

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

interface ChunkedUploadOptions {
  /** An upload route URL in chunk mode (`?chunk=1`). */
  endpoint: string;
  fetcher?: Fetcher;
  mime: string;
  /** The fraction of the file sent so far, after each chunk. */
  onProgress?: (fraction: number) => void;
}

/** The answer that ended the upload: the completing chunk's, or a refusal. */
export interface ChunkedUploadAnswer {
  body: unknown;
  ok: boolean;
  status: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function openedUpload(body: unknown): { fileId: string; token: string } | null {
  return isRecord(body) &&
    typeof body.fileId === "string" &&
    typeof body.token === "string"
    ? { fileId: body.fileId, token: body.token }
    : null;
}

/**
 * Sends a file over 5 MiB to an admin upload route's chunk mode
 * (`lib/chunked-upload.ts`): Appwrite-sized chunks, in order, one at a time.
 * The first answer names the upload and signs its terms; every later chunk
 * repeats them. Stops at the first refused chunk. Network failures reject.
 */
export async function sendInChunks(
  file: File,
  { endpoint, fetcher = fetch, mime, onProgress }: ChunkedUploadOptions
): Promise<ChunkedUploadAnswer> {
  const total = file.size;
  let upload: { fileId: string; token: string } | null = null;
  let answer: ChunkedUploadAnswer = { body: null, ok: false, status: 0 };
  for (let start = 0; start < total; start += CHUNK_BYTES) {
    const end = Math.min(start + CHUNK_BYTES, total) - 1;
    const form = new FormData();
    form.append("chunk", file.slice(start, end + 1), "chunk");
    form.append("filename", file.name);
    form.append("mime", mime);
    form.append("total", String(total));
    if (upload) {
      form.append("fileId", upload.fileId);
      form.append("token", upload.token);
      form.append("start", String(start));
      form.append("end", String(end));
    }
    // Chunks go one at a time: the last one completes the file.
    const response = await fetcher(endpoint, { body: form, method: "POST" });
    const body: unknown = await response.json().catch(() => null);
    answer = { body, ok: response.ok, status: response.status };
    if (!response.ok) {
      return answer;
    }
    upload ??= openedUpload(body);
    if (!upload) {
      return { ...answer, ok: false };
    }
    onProgress?.((end + 1) / total);
  }
  return answer;
}

function failedUpload(
  status: number,
  body: { error?: string } | null
): UploadResult {
  if (status === 401) {
    return { error: "Your session has expired. Sign in and try again." };
  }
  return { error: body?.error ?? `Upload failed (HTTP ${status})` };
}

async function uploadInChunks(
  file: File,
  options: ChunkedUploadOptions
): Promise<UploadResult> {
  try {
    const { body, ok, status } = await sendInChunks(file, options);
    const fileId = isRecord(body) ? body.fileId : undefined;
    const url = isRecord(body) ? body.url : undefined;
    if (ok && typeof fileId === "string" && typeof url === "string") {
      return { fileId, url };
    }
    const error = isRecord(body) ? body.error : undefined;
    return failedUpload(status, {
      error: typeof error === "string" ? error : undefined,
    });
  } catch {
    return {
      error: "Upload failed — check your connection and try again.",
    };
  }
}

/**
 * Browser-side upload through `/api/upload`. Never throws: network failures,
 * proxy errors and non-JSON responses are all returned as `{ error }` so
 * callers can always clear their "uploading" state.
 *
 * Files over 5 MiB go up in chunks where the bucket allows it; the rest, and
 * every file of 5 MiB or less, in one request. `onProgress` gets the fraction
 * sent after each chunk, and 1 once a single request has landed.
 */
export async function uploadFile(
  file: File,
  options: { bucket?: string; onProgress?: (fraction: number) => void } = {}
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

  if (bucket && allowsChunkedUpload(bucket) && file.size > CHUNK_BYTES) {
    return await uploadInChunks(file, {
      endpoint: `/api/upload?bucket=${encodeURIComponent(bucket.id)}&chunk=1`,
      mime: mimeType,
      onProgress: options.onProgress,
    });
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
      return failedUpload(response.status, body);
    }
    options.onProgress?.(1);
    return { fileId: body.fileId, url: body.url };
  } catch {
    return {
      error: "Upload failed — check your connection and try again.",
    };
  }
}

/** Public images (cover images, page/news media) go to the `media` bucket. */
export function uploadMediaFile(
  file: File,
  options: { onProgress?: (fraction: number) => void } = {}
): Promise<UploadResult> {
  return uploadFile(file, { ...options, bucket: MEDIA_BUCKET_ID });
}
