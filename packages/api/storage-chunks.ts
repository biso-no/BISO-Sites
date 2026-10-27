import {
  APPWRITE_PROJECT,
  NEXT_PUBLIC_APPWRITE_ENDPOINT,
  resolveApiKey,
} from "./server-env";
import { getStorageFileUrl } from "./storage";

/**
 * Server-only. Forwards one chunk of a chunked upload to Appwrite's
 * `POST /storage/buckets/{bucketId}/files` with the service key, which is how
 * the SDKs send files over 5 MiB (`Client.chunkedUpload` in node-appwrite):
 *
 * - `content-range: bytes <start>-<end>/<total>`, `end` inclusive;
 * - the first chunk (start 0) creates the file under `fileId`, and every later
 *   chunk names it with `x-appwrite-id`;
 * - each answer is the File, with `chunksUploaded` / `chunksTotal`; the file
 *   exists once they are equal.
 *
 * It does not decide who may upload what: the caller authorises the upload
 * (type, size, chunk boundaries) before calling. Deliberately not exported
 * from `@repo/api/server`: that module is `"use server"`, so every function it
 * exports is a server action a browser could call, and this one writes to any
 * bucket with the service key.
 */

export interface ForwardChunkInput {
  bucketId: string;
  chunk: Blob;
  /** Inclusive, like `content-range`. */
  end: number;
  fileId: string;
  filename: string;
  mime: string;
  start: number;
  total: number;
}

export interface ForwardChunkResult {
  done: boolean;
  fileId: string;
  /** The file's `/view` url, once the last chunk has landed. */
  url?: string;
}

/** Appwrite refused or failed the chunk. */
export class ChunkForwardError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ChunkForwardError";
    this.status = status;
  }
}

/** A 5 MiB chunk between two servers; generous, but never unbounded. */
const CHUNK_TIMEOUT_MS = 60_000;

function assertRange({ chunk, end, start, total }: ForwardChunkInput) {
  const integers = [start, end, total].every(Number.isSafeInteger);
  if (!(integers && start >= 0 && start <= end && end < total)) {
    throw new RangeError(`Invalid chunk range ${start}-${end}/${total}`);
  }
  if (chunk.size !== end - start + 1) {
    throw new RangeError(
      `Chunk holds ${chunk.size} bytes but its range is ${end - start + 1}`
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isComplete(file: Record<string, unknown>): boolean {
  const { chunksTotal, chunksUploaded } = file;
  return (
    typeof chunksTotal === "number" &&
    typeof chunksUploaded === "number" &&
    chunksUploaded >= chunksTotal
  );
}

export async function forwardChunk(
  input: ForwardChunkInput
): Promise<ForwardChunkResult> {
  assertRange(input);
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      "APPWRITE_API_KEY is not configured — chunked uploads cannot run."
    );
  }

  const { bucketId, chunk, end, fileId, filename, mime, start, total } = input;
  const headers: Record<string, string> = {
    "content-range": `bytes ${start}-${end}/${total}`,
    "x-appwrite-key": apiKey,
    "x-appwrite-project": APPWRITE_PROJECT,
  };
  if (start > 0) {
    headers["x-appwrite-id"] = fileId;
  }
  const body = new FormData();
  body.append("fileId", fileId);
  body.append("file", new File([chunk], filename, { type: mime }));

  const response = await fetch(
    `${NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/${encodeURIComponent(bucketId)}/files`,
    {
      body,
      cache: "no-store",
      headers,
      method: "POST",
      signal: AbortSignal.timeout(CHUNK_TIMEOUT_MS),
    }
  );
  const payload: unknown = await response.json().catch(() => null);

  if (!(response.ok && isRecord(payload))) {
    const message =
      isRecord(payload) && typeof payload.message === "string"
        ? payload.message
        : `Appwrite answered HTTP ${response.status}`;
    throw new ChunkForwardError(message, response.status);
  }
  if (payload.$id !== fileId) {
    throw new ChunkForwardError(
      `Appwrite answered for another file (${String(payload.$id)})`,
      502
    );
  }

  return isComplete(payload)
    ? { done: true, fileId, url: getStorageFileUrl(bucketId, fileId) }
    : { done: false, fileId };
}
