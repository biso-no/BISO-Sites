import type { FetchLike } from "./types";

export interface MirrorDeps {
  /** sourceUrl → Appwrite file id, so a re-run never re-uploads. */
  cache: Map<string, string>;
  fetchImpl?: FetchLike;
  upload: (file: File) => Promise<{ $id: string }>;
}

function fileNameFromUrl(sourceUrl: string): string {
  const path = new URL(sourceUrl).pathname;
  return path.split("/").pop() || "image";
}

export async function mirrorImage(
  deps: MirrorDeps,
  sourceUrl: string
): Promise<string> {
  const cached = deps.cache.get(sourceUrl);
  if (cached) {
    return cached;
  }

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
  deps.cache.set(sourceUrl, uploaded.$id);
  return uploaded.$id;
}
