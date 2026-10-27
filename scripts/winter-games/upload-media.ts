/**
 * Upload the Winter Games media (temp/wg-media/, made by process-media.sh) to
 * the `media` bucket under fixed file ids, and write the manifest the page
 * seed reads. Idempotent: a file already stored with the same size is skipped;
 * one stored with a different size stops the run (nothing is deleted or
 * overwritten). Dry run by default; `--write` uploads and writes the manifest.
 *
 * Usage (repo root):
 *   bun --conditions=react-server --env-file=apps/admin/.env.local \
 *     scripts/winter-games/upload-media.ts [--write]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MEDIA_EXT = /\.(mp4|jpg)$/;

export const CHUNK_SIZE = 5 * 1024 * 1024;

/** Manifest key (file name without extension) -> fixed Appwrite file id. */
export const FILE_IDS: Record<string, string> = {
  aftermovie: "wg26-aftermovie",
  "aftermovie-poster": "wg26-aftermovie-poster",
  "header-loop": "wg26-header-loop",
  "header-poster": "wg26-header-poster",
  "card-vinterleker": "wg26-card-vinterleker",
  "card-ski": "wg26-card-ski",
  "card-afterski": "wg26-card-afterski",
  "gallery-aerial": "wg26-gallery-aerial",
  "gallery-selfie": "wg26-gallery-selfie",
  "gallery-friends": "wg26-gallery-friends",
  "gallery-teepees": "wg26-gallery-teepees",
  "gallery-arrival": "wg26-gallery-arrival",
  arena: "wg26-arena",
};

export interface ManifestEntry {
  bytes: number;
  durationSeconds?: number;
  fileId: string;
  height?: number;
  mime: string;
  url: string;
  width?: number;
}

export type Manifest = Record<string, ManifestEntry>;

export interface PlanItem {
  action: "upload" | "skip" | "conflict";
  bytes: number;
  fileId: string;
  name: string;
  remoteBytes?: number;
}

interface ForwardInput {
  bucketId: string;
  chunk: Blob;
  end: number;
  fileId: string;
  filename: string;
  mime: string;
  start: number;
  total: number;
}

export interface MediaDeps {
  bucketId: string;
  files: { name: string; stem: string }[];
  forward: (input: ForwardInput) => Promise<{ done: boolean; fileId: string }>;
  log: (line: string) => void;
  probe: (name: string) => {
    durationSeconds?: number;
    height?: number;
    width?: number;
  };
  readFile: (name: string) => Uint8Array<ArrayBuffer>;
  storage: {
    getFile: (args: {
      bucketId: string;
      fileId: string;
    }) => Promise<{ sizeOriginal: number }>;
  };
  urlFor: (bucketId: string, fileId: string) => string;
}

const NOT_FOUND = 404;

function mimeFor(name: string): string {
  return name.endsWith(".mp4") ? "video/mp4" : "image/jpeg";
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === NOT_FOUND
  );
}

async function planFile(
  deps: MediaDeps,
  file: { name: string; stem: string }
): Promise<PlanItem> {
  const fileId = FILE_IDS[file.stem];
  if (!fileId) {
    throw new Error(`No fixed file id for ${file.name}`);
  }
  const bytes = deps.readFile(file.name).byteLength;
  try {
    const remote = await deps.storage.getFile({
      bucketId: deps.bucketId,
      fileId,
    });
    const action = remote.sizeOriginal === bytes ? "skip" : "conflict";
    return {
      action,
      bytes,
      fileId,
      name: file.name,
      remoteBytes: remote.sizeOriginal,
    };
  } catch (error) {
    if (isNotFound(error)) {
      return { action: "upload", bytes, fileId, name: file.name };
    }
    throw error;
  }
}

async function uploadFile(deps: MediaDeps, item: PlanItem): Promise<void> {
  const data = deps.readFile(item.name);
  const mime = mimeFor(item.name);
  const total = data.byteLength;
  for (let start = 0; start < total; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE, total) - 1;
    await deps.forward({
      bucketId: deps.bucketId,
      chunk: new Blob([data.subarray(start, end + 1)], { type: mime }),
      end,
      fileId: item.fileId,
      filename: item.name,
      mime,
      start,
      total,
    });
  }
}

export async function runUpload(
  deps: MediaDeps,
  { write }: { write: boolean }
): Promise<{ manifest?: Manifest; plan: PlanItem[] }> {
  const plan: PlanItem[] = [];
  for (const file of deps.files) {
    plan.push(await planFile(deps, file));
  }
  for (const item of plan) {
    const note =
      item.action === "conflict"
        ? ` (stored ${item.remoteBytes} bytes, local ${item.bytes})`
        : ` (${item.bytes} bytes)`;
    deps.log(`${item.action.padEnd(8)} ${item.fileId} <- ${item.name}${note}`);
  }
  if (!write) {
    return { plan };
  }

  const conflicts = plan.filter((p) => p.action === "conflict");
  if (conflicts.length > 0) {
    throw new Error(
      `Size conflict, nothing uploaded: ${conflicts.map((c) => c.fileId).join(", ")} already exist with a different size.`
    );
  }

  const manifest: Manifest = {};
  for (const [index, item] of plan.entries()) {
    if (item.action === "upload") {
      await uploadFile(deps, item);
      deps.log(`uploaded ${item.fileId}`);
    }
    const file = deps.files[index];
    if (!file) {
      continue;
    }
    manifest[file.stem] = {
      fileId: item.fileId,
      url: deps.urlFor(deps.bucketId, item.fileId),
      mime: mimeFor(item.name),
      bytes: item.bytes,
      ...deps.probe(item.name),
    };
  }
  return { manifest: sortManifest(manifest), plan };
}

export function sortManifest(manifest: Manifest): Manifest {
  const sorted: Manifest = {};
  for (const key of Object.keys(manifest).sort()) {
    const entry = manifest[key];
    if (!entry) {
      continue;
    }
    sorted[key] = {
      fileId: entry.fileId,
      url: entry.url,
      mime: entry.mime,
      bytes: entry.bytes,
      ...(entry.width === undefined ? {} : { width: entry.width }),
      ...(entry.height === undefined ? {} : { height: entry.height }),
      ...(entry.durationSeconds === undefined
        ? {}
        : { durationSeconds: entry.durationSeconds }),
    };
  }
  return sorted;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MEDIA_DIR = resolve(ROOT, "temp/wg-media");
const MANIFEST_PATH = resolve(
  ROOT,
  "apps/web/src/app/(public)/design-system/winter-games/media.json"
);
const FFPROBE = process.env.FFPROBE ?? "ffprobe";
const MILLIS = 1000;

function ffprobeMedia(name: string) {
  const out = execFileSync(
    FFPROBE,
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      resolve(MEDIA_DIR, name),
    ],
    { encoding: "utf8" }
  );
  const parsed = JSON.parse(out) as {
    format?: { duration?: string };
    streams?: { height?: number; width?: number }[];
  };
  const stream = parsed.streams?.[0];
  const result: { durationSeconds?: number; height?: number; width?: number } =
    { width: stream?.width, height: stream?.height };
  if (name.endsWith(".mp4") && parsed.format?.duration) {
    result.durationSeconds =
      Math.round(Number(parsed.format.duration) * MILLIS) / MILLIS;
  }
  return result;
}

async function main() {
  const write = process.argv.includes("--write");
  const spec = JSON.parse(
    readFileSync(resolve(ROOT, "scripts/winter-games/media-spec.json"), "utf8")
  ) as { outputs: { name: string }[] };
  const files = spec.outputs.map(({ name }) => ({
    name,
    stem: name.replace(MEDIA_EXT, ""),
  }));

  const { createAdminClient } = await import("@repo/api/server");
  const { forwardChunk } = await import("@repo/api/storage-chunks");
  const { getStorageFileUrl } = await import("@repo/api");
  const { storage } = await createAdminClient();

  console.log(write ? "WRITE run" : "DRY run (pass --write to upload)");
  const { manifest, plan } = await runUpload(
    {
      bucketId: "media",
      files,
      forward: forwardChunk,
      log: (line) => console.log(line),
      probe: ffprobeMedia,
      readFile: (name) =>
        new Uint8Array(readFileSync(resolve(MEDIA_DIR, name))),
      storage,
      urlFor: getStorageFileUrl,
    },
    { write }
  );
  if (manifest) {
    mkdirSync(dirname(MANIFEST_PATH), { recursive: true });
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`wrote ${MANIFEST_PATH}`);
  }
  if (!write && plan.some((p) => p.action === "conflict")) {
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main();
}
