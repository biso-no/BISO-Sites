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
 * Every extension the upload buckets take, with the types allowed to carry
 * it: the document map above plus images and video. Windows reports CSV as
 * `application/vnd.ms-excel`.
 */
const EXTENSION_TYPES: Record<string, readonly string[]> = {
  ...Object.fromEntries(
    Object.entries(EXTENSION_MIME_TYPES).map(([extension, type]) => [
      extension,
      [type],
    ])
  ),
  csv: ["text/csv", "application/vnd.ms-excel"],
  gif: ["image/gif"],
  jpeg: ["image/jpeg"],
  jpg: ["image/jpeg"],
  mov: ["video/quicktime"],
  mp4: ["video/mp4"],
  png: ["image/png"],
  svg: ["image/svg+xml"],
  webm: ["video/webm"],
  webp: ["image/webp"],
};

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

/**
 * Whether the file name's extension carries the declared type. Chunk mode
 * checks this, so a `.zip` declared as `video/mp4` cannot borrow the video
 * limit; the bucket's own extension filter then sees a matching name.
 */
export function filenameMatchesMime(filename: string, mime: string): boolean {
  const extension = FILE_EXTENSION_REGEX.exec(filename)?.[1]?.toLowerCase();
  if (!(extension && Object.hasOwn(EXTENSION_TYPES, extension))) {
    return false;
  }
  return EXTENSION_TYPES[extension]?.includes(mime) ?? false;
}

/**
 * Header every chunk request carries. A custom header forces a CORS
 * preflight, which another site fails, so no other page can send chunks with
 * an editor's cookie.
 */
export const CHUNK_UPLOAD_HEADER = "x-biso-upload";

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
    // Above 5 MiB the browser sends it in chunks (`allowsChunkedUpload`);
    // the bucket's own limit in Appwrite is 250 MiB too.
    { bytes: TWO_HUNDRED_FIFTY_MB, types: VIDEO_MIME_TYPES },
    { bytes: DOCUMENT_MAX_BYTES, types: DOCUMENT_MIME_TYPES },
  ]),
};

/**
 * Whether files over one chunk may go up in chunks. The chunk forwarder writes
 * with the service key, so only buckets the route already writes with the
 * service key qualify: chunking must never widen what an editor's own session
 * may write. The rest keep the single request.
 */
export function allowsChunkedUpload(bucket: UploadBucketConfig): boolean {
  return bucket.client === "admin";
}

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

const CONTENT_LENGTH_REGEX = /^\d{1,16}$/;

/**
 * The request's declared body size, or null when it is missing, not a plain
 * integer, or zero. The upload routes answer 411 then: every browser sends a
 * length for a file or form body.
 */
export function readContentLength(headers: Headers): number | null {
  const value = headers.get("content-length")?.trim() ?? "";
  if (!CONTENT_LENGTH_REGEX.test(value)) {
    return null;
  }
  const length = Number(value);
  return length > 0 ? length : null;
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
