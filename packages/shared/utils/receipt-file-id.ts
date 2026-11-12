const APPWRITE_FILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

const STORAGE_FILE_URL_RE =
  /\/storage\/buckets\/[^/?#]+\/files\/([^/?#]+)\/(?:view|preview|download)(?:[/?#]|$)/;

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A stray "%" is not an encoding; take the segment as written.
    return value;
  }
}

/**
 * The `expenses` bucket file id one attachment `url` names, or null.
 *
 * Receipts uploaded through the web or `POST /api/expenses/attachments` store
 * a bare file id, but older rows stored the whole view URL. Both forms name
 * the same file, so both have to resolve to the same id: a reference check
 * that compared the raw strings would not see a legacy row pointing at the
 * file a newer draft names, and would delete a receipt that is still in use.
 */
export function receiptFileId(url: string | null | undefined): string | null {
  const value = url?.trim() ?? "";
  if (!value) {
    return null;
  }
  if (APPWRITE_FILE_ID_RE.test(value)) {
    return value;
  }

  const fromUrl = STORAGE_FILE_URL_RE.exec(value)?.[1];
  if (!fromUrl) {
    return null;
  }
  const decoded = decodeSegment(fromUrl);
  return APPWRITE_FILE_ID_RE.test(decoded) ? decoded : null;
}
