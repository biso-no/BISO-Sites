/**
 * Allowed file types for reimbursement receipts / bank statements.
 *
 * Restricted to the formats the ledger PDF merge can actually embed, so the
 * posted 24SevenOffice document always contains every supporting file. Phone
 * formats like HEIC/HEIF and WebP are intentionally rejected at upload rather
 * than silently dropped later.
 */

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export type AllowedReceiptMimeType =
  (typeof ALLOWED_RECEIPT_MIME_TYPES)[number];

/** Value for the `accept` attribute of receipt file inputs. */
export const RECEIPT_FILE_ACCEPT = ALLOWED_RECEIPT_MIME_TYPES.join(",");

/** Human-readable list of accepted formats, for error messages. */
export const ALLOWED_RECEIPT_LABEL = "PDF, PNG, or JPEG";

/** Strips MIME parameters (e.g. "; charset=…") and lowercases. */
function normalizeMimeType(type: string | null | undefined): string {
  return (type ?? "").split(";")[0].trim().toLowerCase();
}

export function isAllowedReceiptMimeType(
  type: string | null | undefined
): boolean {
  const normalized = normalizeMimeType(type);
  return ALLOWED_RECEIPT_MIME_TYPES.some((allowed) => allowed === normalized);
}
