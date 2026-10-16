import type { FetchLike } from "./types";

export interface MirrorDeps {
  /**
   * sourceUrl → the in-flight or settled upload, so a re-run never re-uploads.
   *
   * The value is the *promise*, not the finished file id: products are
   * mirrored concurrently, and a cache of resolved ids only dedupes uploads
   * that have already finished. Two products sharing an image would both miss
   * a `Map<string, string>` and upload it twice.
   */
  cache: Map<string, Promise<string>>;
  fetchImpl?: FetchLike;
  upload: (file: File) => Promise<{ $id: string }>;
}

function fileNameFromUrl(sourceUrl: string): string {
  const path = new URL(sourceUrl).pathname;
  return path.split("/").pop() || "image";
}

async function downloadAndUpload(
  deps: MirrorDeps,
  sourceUrl: string
): Promise<string> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const response = await fetchImpl(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${sourceUrl}: ${response.status}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const file = new File([bytes], fileNameFromUrl(sourceUrl), {
    type: response.headers.get("Content-Type") ?? "application/octet-stream",
  });

  const uploaded = await deps.upload(file);
  return uploaded.$id;
}

export function mirrorImage(
  deps: MirrorDeps,
  sourceUrl: string
): Promise<string> {
  const cached = deps.cache.get(sourceUrl);
  if (cached) {
    return cached;
  }

  // A failure is evicted rather than cached: one flaky download must not
  // condemn every later product that references the same image.
  const pending = downloadAndUpload(deps, sourceUrl).catch((error: unknown) => {
    deps.cache.delete(sourceUrl);
    throw error;
  });
  deps.cache.set(sourceUrl, pending);
  return pending;
}
