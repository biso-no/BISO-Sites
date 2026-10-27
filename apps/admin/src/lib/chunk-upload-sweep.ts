import "server-only";
import { Query } from "@repo/api";
import { UPLOAD_TOKEN_TTL_MS } from "./upload-token";

/**
 * Deletes chunked uploads that were started and never finished. Such a file
 * holds its chunks in the bucket indefinitely; once its upload token has
 * expired nothing can finish it. Appwrite stores an unfinished upload with an
 * empty `signature` (it is set when the last chunk lands), and `listFiles`
 * may filter on `signature` and `$createdAt`, so one cheap query finds them.
 * `deleteFile` on an unfinished file aborts it and drops its chunks.
 */

/** As long as an upload token lives: nothing older can still finish. */
export const STALE_CHUNK_UPLOAD_MS = UPLOAD_TOKEN_TTL_MS;

const SWEEP_LIMIT = 25;

interface SweepFile {
  $createdAt: string;
  $id: string;
  chunksTotal: number;
  chunksUploaded: number;
}

/** The slice of the Appwrite `Storage` service the sweep uses. */
export interface SweepStorage {
  deleteFile(params: { bucketId: string; fileId: string }): Promise<unknown>;
  listFiles(params: {
    bucketId: string;
    queries: string[];
  }): Promise<{ files: SweepFile[] }>;
}

/** Returns the IDs it deleted; at most 25 per call. */
export async function sweepStaleChunkUploads(
  storage: SweepStorage,
  { bucketId, now = Date.now() }: { bucketId: string; now?: number }
): Promise<string[]> {
  const cutoff = now - STALE_CHUNK_UPLOAD_MS;
  const { files } = await storage.listFiles({
    bucketId,
    queries: [
      Query.equal("signature", [""]),
      Query.lessThan("$createdAt", new Date(cutoff).toISOString()),
      Query.limit(SWEEP_LIMIT),
    ],
  });
  // Re-checked here, so a finished or recent file is never deleted, whatever
  // the query matched.
  const stale = files
    .filter(
      (file) =>
        file.chunksUploaded < file.chunksTotal &&
        Date.parse(file.$createdAt) < cutoff
    )
    .slice(0, SWEEP_LIMIT);
  const results = await Promise.allSettled(
    stale.map((file) => storage.deleteFile({ bucketId, fileId: file.$id }))
  );
  return stale
    .filter((_, index) => results[index]?.status === "fulfilled")
    .map((file) => file.$id);
}
