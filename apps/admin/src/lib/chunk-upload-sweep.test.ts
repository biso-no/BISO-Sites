import { describe, expect, it, mock } from "bun:test";
import { Query } from "@repo/api";

// `./chunk-upload-sweep` starts with `import "server-only"`, which throws
// outside a react-server build.
mock.module("server-only", () => ({}));

const { STALE_CHUNK_UPLOAD_MS, sweepStaleChunkUploads } = await import(
  "./chunk-upload-sweep"
);

const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const OLD = new Date(NOW - STALE_CHUNK_UPLOAD_MS - 1000).toISOString();
const RECENT = new Date(NOW - 60_000).toISOString();

interface FakeFile {
  $createdAt: string;
  $id: string;
  chunksTotal: number;
  chunksUploaded: number;
}

function fakeStorage(files: FakeFile[], failing: string[] = []) {
  return {
    deleteFile: mock(({ fileId }: { bucketId: string; fileId: string }) =>
      failing.includes(fileId)
        ? Promise.reject(new Error("delete failed"))
        : Promise.resolve({})
    ),
    listFiles: mock((_params: { bucketId: string; queries: string[] }) =>
      Promise.resolve({ files, total: files.length })
    ),
  };
}

describe("sweepStaleChunkUploads", () => {
  it("is as old as an upload token lives", () => {
    expect(STALE_CHUNK_UPLOAD_MS).toBe(6 * 60 * 60 * 1000);
  });

  it("asks Appwrite only for unfinished files older than the cutoff, 25 at most", async () => {
    const storage = fakeStorage([]);
    await sweepStaleChunkUploads(storage, { bucketId: "media", now: NOW });

    expect(storage.listFiles).toHaveBeenCalledTimes(1);
    expect(storage.listFiles.mock.calls[0]?.[0]).toEqual({
      bucketId: "media",
      queries: [
        // Appwrite stores an unfinished upload with an empty signature.
        Query.equal("signature", [""]),
        Query.lessThan(
          "$createdAt",
          new Date(NOW - STALE_CHUNK_UPLOAD_MS).toISOString()
        ),
        Query.limit(25),
      ],
    });
  });

  it("deletes stale partial uploads and nothing else", async () => {
    const storage = fakeStorage([
      { $createdAt: OLD, $id: "stale", chunksTotal: 50, chunksUploaded: 3 },
      { $createdAt: OLD, $id: "finished", chunksTotal: 3, chunksUploaded: 3 },
      {
        $createdAt: RECENT,
        $id: "in-flight",
        chunksTotal: 9,
        chunksUploaded: 2,
      },
    ]);

    const deleted = await sweepStaleChunkUploads(storage, {
      bucketId: "media",
      now: NOW,
    });

    expect(deleted).toEqual(["stale"]);
    expect(storage.deleteFile.mock.calls.map(([call]) => call)).toEqual([
      { bucketId: "media", fileId: "stale" },
    ]);
  });

  it("keeps going past a failed delete and never deletes more than 25", async () => {
    const files = Array.from({ length: 30 }, (_, index) => ({
      $createdAt: OLD,
      $id: `partial-${index}`,
      chunksTotal: 10,
      chunksUploaded: 1,
    }));
    const storage = fakeStorage(files, ["partial-0"]);

    const deleted = await sweepStaleChunkUploads(storage, {
      bucketId: "media",
      now: NOW,
    });

    expect(storage.deleteFile).toHaveBeenCalledTimes(25);
    expect(deleted).toHaveLength(24);
    expect(deleted).not.toContain("partial-0");
  });
});
