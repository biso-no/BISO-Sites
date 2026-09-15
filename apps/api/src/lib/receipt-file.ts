import type { AllowedReceiptMimeType } from "@repo/shared/utils/expense-attachments";

/** The `expenses` bucket rejects anything larger. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const EXTENSION_BY_TYPE: Record<AllowedReceiptMimeType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const TRAILING_SLASHES_RE = /\/+$/;
const PATH_PREFIX_RE = /^.*[\\/]/;
const EXTENSION_RE = /\.[^.]*$/;
const UNSAFE_NAME_CHARS_RE = /[^\p{L}\p{N} ._-]/gu;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * A receipt's real type, read from its first bytes.
 *
 * The declared content type is not trusted: the ledger merge can only embed
 * PDF, PNG and JPEG, and a mislabelled file (a HEIC photo named `.jpg`) would
 * only fail at posting time, long after the student submitted it.
 */
export function sniffReceiptMimeType(
  bytes: Uint8Array
): AllowedReceiptMimeType | null {
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return "application/pdf";
  }
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }
  return null;
}

/**
 * The stored file name: the original base name, stripped of any path and of
 * characters that do not belong in a file name, with the extension of the
 * sniffed type — the bucket's extension allow-list checks the name.
 */
export function receiptFileName(
  originalName: string | null | undefined,
  mimeType: AllowedReceiptMimeType
): string {
  const base = (originalName ?? "")
    .replace(PATH_PREFIX_RE, "")
    .replace(EXTENSION_RE, "")
    .replace(UNSAFE_NAME_CHARS_RE, "")
    .trim()
    .slice(0, 80);
  return `${base || "receipt"}.${EXTENSION_BY_TYPE[mimeType]}`;
}

/** Same endpoint and project resolution as `@repo/api/server`. */
export function receiptViewUrl(fileId: string): string {
  const endpoint = (
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ||
    process.env.APPWRITE_ENDPOINT ||
    "https://appwrite.biso.no/v1"
  ).replace(TRAILING_SLASHES_RE, "");
  const project =
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT ||
    process.env.APPWRITE_PROJECT_ID ||
    "biso";
  return (
    `${endpoint}/storage/buckets/expenses/files/${encodeURIComponent(fileId)}/view?` +
    `project=${encodeURIComponent(project)}`
  );
}
