const MB = 1024 * 1024;
const TEN_MB = 10 * MB;
const TWO_HUNDRED_FIFTY_MB = 250 * MB;
const DOCUMENT_MAX_BYTES = 25 * MB;

/** Largest image the editor takes. */
export const IMAGE_MAX_BYTES = TEN_MB;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

/** What the page editor's video block invites: mp4, mov, webm. */
const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

/**
 * What the Documents block offers, with the aliases browsers really send:
 * Windows reports CSV as `application/vnd.ms-excel`. No zip, html or
 * `application/x-*`, even though the bucket's own extension list has zip.
 */
const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const EXTENSION_MIME_TYPES: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const FILE_EXTENSION_REGEX = /\.([a-z0-9]{1,10})$/i;

/**
 * The document type for a file name. Browsers leave `File.type` empty for
 * some documents (CSV without Excel installed), and the route would then see
 * octet-stream and refuse it. Only document extensions are named.
 */
export function mimeFromFilename(name: string): string | null {
  const extension = FILE_EXTENSION_REGEX.exec(name)?.[1]?.toLowerCase();
  return extension && Object.hasOwn(EXTENSION_MIME_TYPES, extension)
    ? (EXTENSION_MIME_TYPES[extension] ?? null)
    : null;
}

export interface UploadBucketConfig {
  /** "admin" uses the service key (after the route's auth check). */
  client: "admin" | "session";
  id: string;
  /** Byte limit per allowed type. */
  limits: ReadonlyMap<string, number>;
  /** The largest limit of any type: the cap for the whole request body. */
  maxBytes: number;
  /** Allowed types. Anything not here is rejected. */
  mimeTypes: ReadonlySet<string>;
}

export const DEFAULT_UPLOAD_BUCKET = "content";

function defineBucket(
  config: Pick<UploadBucketConfig, "client" | "id">,
  groups: { bytes: number; types: readonly string[] }[]
): UploadBucketConfig {
  const limits = new Map<string, number>();
  for (const { bytes, types } of groups) {
    for (const type of types) {
      limits.set(type, bytes);
    }
  }
  return {
    ...config,
    limits,
    maxBytes: Math.max(...limits.values()),
    mimeTypes: new Set(limits.keys()),
  };
}

/** The byte limit for a type in a bucket, or null when it is not allowed. */
export function maxBytesForMime(
  bucket: UploadBucketConfig,
  mimeType: string
): number | null {
  return bucket.limits.get(mimeType) ?? null;
}

/**
 * Buckets the admin `/api/upload` route may write to. Anything not listed is
 * rejected, so the `bucket` query param can never target private buckets such
 * as `resumes` or `expenses`.
 */
const UPLOAD_BUCKETS: Record<string, UploadBucketConfig> = {
  content: defineBucket({ client: "session", id: "content" }, [
    { bytes: TEN_MB, types: [...IMAGE_MIME_TYPES, "application/pdf"] },
  ]),
  // Bucket create permission is Operations Unit only; every admin editor
  // needs to upload cover images, so this mirrors the former
  // `uploadMediaFile` server action.
  media: defineBucket({ client: "admin", id: "media" }, [
    { bytes: IMAGE_MAX_BYTES, types: IMAGE_MIME_TYPES },
    // Stage 5 raises video with chunked upload.
    { bytes: TWO_HUNDRED_FIFTY_MB, types: VIDEO_MIME_TYPES },
    { bytes: DOCUMENT_MAX_BYTES, types: DOCUMENT_MIME_TYPES },
  ]),
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
