import { ID } from "@repo/api";
import { CHUNK_BYTES } from "@repo/api/storage";
import {
  type ForwardChunkInput,
  type ForwardChunkResult,
  forwardChunk,
} from "@repo/api/storage-chunks";
import { NextResponse } from "next/server";
import { sanitizeUploadFilename } from "./upload-buckets";
import { createUploadToken, verifyUploadToken } from "./upload-token";

/**
 * Server-only chunk mode for the admin upload routes (`?chunk=1`), for files
 * over one Appwrite chunk (5 MiB), which a single request through Appwrite
 * Sites cannot carry. Each request is multipart with the chunk's bytes in
 * `chunk` and the upload's terms in `total`, `mime` and `filename`:
 *
 * - **First chunk** (no `fileId`): exactly 5 MiB. The route checks the type
 *   and total against its policy, forwards bytes 0–5 MiB under a new file ID
 *   and answers `{ fileId, token }`. The token signs the terms
 *   (`upload-token.ts`).
 * - **Every later chunk** also carries `fileId`, `token`, `start` and `end`
 *   (inclusive). The token must match the terms it repeats, so the type, the
 *   total, the name and the editor cannot change mid-upload. The range must
 *   start on a chunk boundary after the first, end before `total`, match the
 *   bytes sent, and be a whole chunk unless it is the last one. A middle chunk
 *   answers `{ fileId }`; the last one answers through the route's `complete`.
 *
 * Every refusal happens before anything is sent to Appwrite. Chunks must be
 * sent in order, one at a time; the last one completes the file.
 */

const MB = 1024 * 1024;

/** Multipart framing around one chunk: boundary lines and the small fields. */
const FORM_OVERHEAD_BYTES = 64 * 1024;

const INTEGER_REGEX = /^\d{1,16}$/;
const FILE_ID_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;

/** Whether the request asked for chunk mode. */
export function isChunkRequest(request: Request): boolean {
  return new URL(request.url).searchParams.get("chunk") === "1";
}

export interface ChunkUploadPolicy {
  bucketId: string;
  /** The byte limit for this type and name, or null when it is refused. */
  limitFor: (mime: string, filename: string) => number | null;
}

export interface CompletedChunkUpload {
  fileId: string;
  filename: string;
  mime: string;
  total: number;
  url: string;
}

interface ChunkUploadOptions {
  /** The response for the chunk that completes the file. */
  complete: (upload: CompletedChunkUpload) => Response;
  policy: ChunkUploadPolicy;
  userId: string;
}

interface ChunkTerms {
  chunk: Blob;
  filename: string;
  mime: string;
  total: number;
}

function refuse(error: string, status: number): Response {
  return NextResponse.json({ error }, { status });
}

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

function readInteger(value: FormDataEntryValue | null): number | null {
  return typeof value === "string" && INTEGER_REGEX.test(value)
    ? Number(value)
    : null;
}

/** The terms every chunk repeats, checked against the route's policy. */
function readTerms(
  form: FormData,
  policy: ChunkUploadPolicy
): ChunkTerms | Response {
  const chunk = form.get("chunk");
  if (!(chunk instanceof Blob) || chunk.size === 0) {
    return refuse("Missing chunk", 400);
  }
  if (chunk.size > CHUNK_BYTES) {
    return refuse(`Chunk too large (max ${CHUNK_BYTES / MB} MB)`, 413);
  }
  const total = readInteger(form.get("total"));
  if (total === null) {
    return refuse("Missing or invalid file size", 400);
  }
  if (total <= CHUNK_BYTES) {
    return refuse("Send files of 5 MB or less in one request", 400);
  }
  const mime = readText(form.get("mime")).trim().toLowerCase();
  const filename = sanitizeUploadFilename(
    readText(form.get("filename")) || undefined
  );
  const limit = policy.limitFor(mime, filename);
  if (limit === null) {
    return refuse("Unsupported file type", 415);
  }
  if (total > limit) {
    return refuse(`File too large (max ${limit / MB} MB)`, 413);
  }
  return { chunk, filename, mime, total };
}

/** The chunk's place in the file, checked against the authorised total. */
function readRange(
  form: FormData,
  { chunk, total }: ChunkTerms
): { end: number; start: number } | Response {
  const start = readInteger(form.get("start"));
  const end = readInteger(form.get("end"));
  if (start === null || end === null) {
    return refuse("Missing chunk range", 400);
  }
  if (end >= total) {
    return refuse("Chunk runs past the end of the file", 400);
  }
  const onBoundary = start >= CHUNK_BYTES && start % CHUNK_BYTES === 0;
  if (!onBoundary || end < start) {
    return refuse("Chunk does not start on a chunk boundary", 400);
  }
  const length = end - start + 1;
  if (length !== chunk.size) {
    return refuse("Chunk does not match its range", 400);
  }
  if (end !== total - 1 && length !== CHUNK_BYTES) {
    return refuse("Only the last chunk may be shorter than 5 MB", 400);
  }
  return { end, start };
}

async function forward(
  input: ForwardChunkInput,
  userId: string
): Promise<ForwardChunkResult | Response> {
  try {
    return await forwardChunk(input);
  } catch (error) {
    console.error("[upload] chunk forward failed", {
      bucket: input.bucketId,
      end: input.end,
      error,
      fileId: input.fileId,
      start: input.start,
      total: input.total,
      userId,
    });
    return refuse("Upload failed. Please try again.", 502);
  }
}

async function openUpload(
  terms: ChunkTerms,
  { policy, userId }: ChunkUploadOptions
): Promise<Response> {
  if (terms.chunk.size !== CHUNK_BYTES) {
    return refuse("The first chunk must be exactly 5 MB", 400);
  }
  const fileId = ID.unique();
  // Signed first, so a signing failure never leaves a started file behind.
  const token = createUploadToken({
    bucketId: policy.bucketId,
    fileId,
    filename: terms.filename,
    mime: terms.mime,
    total: terms.total,
    userId,
  });
  const result = await forward(
    {
      ...terms,
      bucketId: policy.bucketId,
      end: CHUNK_BYTES - 1,
      fileId,
      start: 0,
    },
    userId
  );
  if (result instanceof Response) {
    return result;
  }
  return NextResponse.json({ fileId, token });
}

async function continueUpload(
  form: FormData,
  terms: ChunkTerms,
  { complete, policy, userId }: ChunkUploadOptions
): Promise<Response> {
  const fileId = readText(form.get("fileId"));
  const authorised =
    FILE_ID_REGEX.test(fileId) &&
    verifyUploadToken(readText(form.get("token")), {
      bucketId: policy.bucketId,
      fileId,
      filename: terms.filename,
      mime: terms.mime,
      total: terms.total,
      userId,
    });
  if (!authorised) {
    return refuse("Upload token is not valid for this file", 403);
  }
  const range = readRange(form, terms);
  if (range instanceof Response) {
    return range;
  }
  const { end, start } = range;

  const result = await forward(
    { ...terms, bucketId: policy.bucketId, end, fileId, start },
    userId
  );
  if (result instanceof Response) {
    return result;
  }
  if (end !== terms.total - 1) {
    return NextResponse.json({ fileId });
  }
  if (!(result.done && result.url)) {
    return refuse("Upload incomplete: a part never arrived. Try again.", 409);
  }
  return complete({
    fileId,
    filename: terms.filename,
    mime: terms.mime,
    total: terms.total,
    url: result.url,
  });
}

export async function handleChunkedUpload(
  request: Request,
  options: ChunkUploadOptions
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > CHUNK_BYTES + FORM_OVERHEAD_BYTES) {
    return refuse(`Chunk too large (max ${CHUNK_BYTES / MB} MB)`, 413);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return refuse("Malformed chunk upload", 400);
  }
  const terms = readTerms(form, options.policy);
  if (terms instanceof Response) {
    return terms;
  }
  return form.has("fileId")
    ? await continueUpload(form, terms, options)
    : await openUpload(terms, options);
}
