/**
 * Finago REST API — Document upload
 *
 * Three-step flow:
 *   1. POST /fileUpload { contentType }      → { uploadMethod, uploadUrl, fileId }
 *   2. PUT the bytes to the presigned uploadUrl (NO Finago bearer token — the URL
 *      carries its own signature)
 *   3. Poll GET /fileUpload/{fileId} until status=Completed → documentId
 *
 * The returned documentId is what gets attached to a ledger transaction.
 */

import { finago } from "./client";

export interface UploadDocumentResult {
  documentId: number;
  fileId: string;
}

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Uploads a single document to Finago and resolves its documentId once the
 * upload has been processed. `bytes` should be the raw file content (e.g. a PDF).
 */
export async function uploadDocument(
  bytes: Uint8Array | ArrayBuffer | Blob,
  contentType: string
): Promise<UploadDocumentResult> {
  const { data: init, error: initError } = await finago.POST("/fileUpload", {
    body: { contentType },
    params: { header: { Authorization: "" } },
  });

  if (initError || !init) {
    throw new Error(
      `[Finago] fileUpload init failed: ${JSON.stringify(initError)}`
    );
  }

  // Cast at the interop boundary: TS narrows typed arrays to a generic
  // ArrayBufferLike backing that BlobPart rejects, but the runtime value is a
  // valid Blob part.
  const body =
    bytes instanceof Blob
      ? bytes
      : new Blob([bytes as BlobPart], { type: contentType });
  const putResponse = await fetch(init.uploadUrl, {
    method: init.uploadMethod || "PUT",
    headers: { "Content-Type": contentType },
    body,
  });

  if (!putResponse.ok) {
    const text = await putResponse.text().catch(() => "");
    throw new Error(
      `[Finago] file upload PUT failed: ${putResponse.status} ${text}`
    );
  }

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() <= deadline) {
    const { data: status, error: statusError } = await finago.GET(
      "/fileUpload/{fileId}",
      {
        params: {
          path: { fileId: init.fileId },
          header: { Authorization: "" },
        },
      }
    );

    if (statusError || !status) {
      throw new Error(
        `[Finago] fileUpload status failed: ${JSON.stringify(statusError)}`
      );
    }

    const state = status.status?.toLowerCase();
    if (state === "completed" && status.documentId) {
      return { documentId: status.documentId, fileId: init.fileId };
    }
    if (state === "failed") {
      throw new Error(`[Finago] file upload failed for fileId ${init.fileId}`);
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`[Finago] file upload timed out for fileId ${init.fileId}`);
}
