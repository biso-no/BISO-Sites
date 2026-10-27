import { describe, expect, it } from "bun:test";
import {
  CHUNK_SIZE,
  FILE_IDS,
  type MediaDeps,
  runUpload,
} from "./upload-media";

const BUCKET = "media";
const MEDIA_EXT = /\.(mp4|jpg)$/;
const CONFLICT_ID = /wg26-card-ski/;
const STEMS = Object.keys(FILE_IDS);

function makeDeps(
  overrides: {
    remote?: Record<string, number>;
    sizes?: Record<string, number>;
  } = {}
) {
  const remote = overrides.remote ?? {};
  const forwarded: { fileId: string; start: number; end: number }[] = [];
  const deps: MediaDeps = {
    bucketId: BUCKET,
    files: STEMS.map((stem) => ({
      stem,
      name:
        stem.includes("loop") || stem === "aftermovie"
          ? `${stem}.mp4`
          : `${stem}.jpg`,
    })),
    forward: (input) => {
      forwarded.push({
        fileId: input.fileId,
        start: input.start,
        end: input.end,
      });
      return Promise.resolve({
        done: input.end === input.total - 1,
        fileId: input.fileId,
      });
    },
    log: () => undefined,
    probe: () => ({ width: 100, height: 50 }),
    readFile: (name) => {
      const stem = name.replace(MEDIA_EXT, "");
      return new Uint8Array(overrides.sizes?.[stem] ?? 10);
    },
    storage: {
      getFile: ({ fileId }) => {
        const size = remote[fileId];
        if (size === undefined) {
          return Promise.reject(Object.assign(new Error("nf"), { code: 404 }));
        }
        return Promise.resolve({ sizeOriginal: size });
      },
    },
    urlFor: (bucket, fileId) => `https://x/${bucket}/${fileId}`,
  };
  return { deps, forwarded };
}

describe("runUpload", () => {
  it("dry run plans 13 files and uploads nothing", async () => {
    const { deps, forwarded } = makeDeps();
    const result = await runUpload(deps, { write: false });
    expect(result.plan).toHaveLength(13);
    expect(result.plan.every((p) => p.action === "upload")).toBe(true);
    expect(forwarded).toHaveLength(0);
    expect(result.manifest).toBeUndefined();
  });

  it("skips same-size files and uploads missing ones in ranges", async () => {
    const total = CHUNK_SIZE * 2 + 5;
    const { deps, forwarded } = makeDeps({
      remote: { "wg26-arena": 10 },
      sizes: { aftermovie: total },
    });
    const result = await runUpload(deps, { write: true });
    expect(result.plan.find((p) => p.fileId === "wg26-arena")?.action).toBe(
      "skip"
    );
    expect(forwarded.some((f) => f.fileId === "wg26-arena")).toBe(false);
    const film = forwarded.filter((f) => f.fileId === "wg26-aftermovie");
    expect(film.map((f) => [f.start, f.end])).toEqual([
      [0, CHUNK_SIZE - 1],
      [CHUNK_SIZE, CHUNK_SIZE * 2 - 1],
      [CHUNK_SIZE * 2, total - 1],
    ]);
  });

  it("builds a manifest with all 13 keys", async () => {
    const { deps } = makeDeps();
    const result = await runUpload(deps, { write: true });
    const manifest = result.manifest ?? {};
    expect(Object.keys(manifest)).toEqual([...STEMS].sort());
    expect(Object.keys(manifest)).toHaveLength(13);
    expect(manifest.arena).toMatchObject({
      fileId: "wg26-arena",
      url: "https://x/media/wg26-arena",
      mime: "image/jpeg",
      bytes: 10,
      width: 100,
      height: 50,
    });
    expect(manifest.aftermovie?.mime).toBe("video/mp4");
  });

  it("stops on a size conflict before uploading anything", async () => {
    const { deps, forwarded } = makeDeps({ remote: { "wg26-card-ski": 99 } });
    await expect(runUpload(deps, { write: true })).rejects.toThrow(CONFLICT_ID);
    expect(forwarded).toHaveLength(0);
  });

  it("reports a conflict in a dry run without throwing", async () => {
    const { deps } = makeDeps({ remote: { "wg26-card-ski": 99 } });
    const result = await runUpload(deps, { write: false });
    expect(result.plan.filter((p) => p.action === "conflict")).toHaveLength(1);
  });
});
