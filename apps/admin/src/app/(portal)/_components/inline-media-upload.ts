import { CHUNK_BYTES } from "@repo/api/storage";
import type { InlineMediaUpload } from "@/lib/inline-media";
import { sendInChunks } from "@/lib/upload-client";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInlineMediaUpload(value: unknown): value is InlineMediaUpload {
  if (!isRecord(value)) {
    return false;
  }

  const mediaKind = value.mediaKind;
  const hasValidMediaKind =
    mediaKind === "audio" ||
    mediaKind === "file" ||
    mediaKind === "image" ||
    mediaKind === "video";

  return (
    typeof value.fileId === "string" &&
    typeof value.fileName === "string" &&
    hasValidMediaKind &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    Number.isFinite(value.size) &&
    value.size >= 0 &&
    typeof value.url === "string"
  );
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** Files over 5 MiB go up in chunks; the rest in one request. */
async function send(
  file: File,
  fetcher: Fetcher
): Promise<{ body: unknown; ok: boolean }> {
  if (file.size > CHUNK_BYTES) {
    return await sendInChunks(file, {
      endpoint: "/api/media/upload?chunk=1",
      fetcher,
      mime: file.type,
    });
  }
  const response = await fetcher("/api/media/upload", {
    body: file,
    headers: {
      "content-type": file.type,
      "x-filename": encodeURIComponent(file.name),
    },
    method: "POST",
  });
  return { body: await readResponseBody(response), ok: response.ok };
}

export async function uploadInlineMedia(
  file: File,
  fetcher: Fetcher = fetch
): Promise<InlineMediaUpload> {
  const { body, ok } = await send(file, fetcher);

  if (!ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : "Upload failed";
    throw new Error(message);
  }

  if (!(isRecord(body) && isInlineMediaUpload(body.file))) {
    throw new Error("Invalid upload response");
  }

  return body.file;
}
