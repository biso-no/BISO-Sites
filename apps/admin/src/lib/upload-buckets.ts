const TEN_MB = 10 * 1024 * 1024;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export interface UploadBucketConfig {
  /** "admin" uses the service key (after the route's auth check). */
  client: "admin" | "session";
  id: string;
  maxBytes: number;
  mimeTypes: ReadonlySet<string>;
}

export const DEFAULT_UPLOAD_BUCKET = "content";

/**
 * Buckets the admin `/api/upload` route may write to. Anything not listed is
 * rejected, so the `bucket` query param can never target private buckets such
 * as `resumes` or `expenses`.
 */
const UPLOAD_BUCKETS: Record<string, UploadBucketConfig> = {
  content: {
    client: "session",
    id: "content",
    maxBytes: TEN_MB,
    mimeTypes: new Set([...IMAGE_MIME_TYPES, "application/pdf"]),
  },
  media: {
    // Bucket create permission is Operations Unit only; every admin editor
    // needs to upload cover images, so this mirrors the former
    // `uploadMediaFile` server action.
    client: "admin",
    id: "media",
    maxBytes: TEN_MB,
    mimeTypes: new Set(IMAGE_MIME_TYPES),
  },
};

export function resolveUploadBucket(
  bucketId: string
): UploadBucketConfig | null {
  return Object.hasOwn(UPLOAD_BUCKETS, bucketId)
    ? (UPLOAD_BUCKETS[bucketId] ?? null)
    : null;
}

const FILENAME_REGEX = /[^a-z0-9._-]/gi;
const EXTENSION_REGEX = /\.[a-z0-9]{1,10}$/i;
const MAX_FILENAME_LENGTH = 120;

export function decodeUploadFilename(value: string | null): string | undefined {
  if (!value) {
    return;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Keeps the extension when truncating — buckets filter on it. */
export function sanitizeUploadFilename(name: string | undefined): string {
  const fallback = "upload.bin";
  if (!name) {
    return fallback;
  }
  const cleaned = name.replace(FILENAME_REGEX, "_");
  if (cleaned.length <= MAX_FILENAME_LENGTH) {
    return cleaned || fallback;
  }
  const extension = EXTENSION_REGEX.exec(cleaned)?.[0] ?? "";
  return `${cleaned.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`;
}

/**
 * Under `bun --bun next dev`, `request.blob()` drops the request's
 * Content-Type, so the Blob reports `type: ""`. Fall back to the header (minus
 * any `; charset=…` parameter) before defaulting to octet-stream.
 */
export function resolveUploadMimeType(
  blobType: string,
  contentTypeHeader: string | null
): string {
  const raw = blobType || contentTypeHeader?.split(";")[0] || "";
  return raw.trim().toLowerCase() || "application/octet-stream";
}
