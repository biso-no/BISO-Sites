/**
 * The files an application carries: the CV and the cover letter, both PDFs
 * in the `resumes` bucket. The cover letter used to be a free-text box; HR
 * found the texts too short to judge, so it is a required upload now.
 */

export const APPLICATION_DOCUMENTS = ["resume", "cover_letter"] as const;
export type ApplicationDocument = (typeof APPLICATION_DOCUMENTS)[number];

export const APPLICATION_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const PDF_MIME_TYPE = "application/pdf";
/** How much extracted cover-letter text the screener and the drawer get. */
const COVER_LETTER_TEXT_MAX_CHARS = 12_000;
const PDF_EXTENSION = /\.pdf$/i;

export interface ApplicationDocumentFiles {
  cover_letter_file_id?: string | null;
  resume_file_id?: string | null;
}

export function isApplicationDocument(
  value: string
): value is ApplicationDocument {
  return (APPLICATION_DOCUMENTS as readonly string[]).includes(value);
}

export function applicationDocumentFileId(
  row: ApplicationDocumentFiles,
  document: ApplicationDocument
): string | null {
  return (
    (document === "resume" ? row.resume_file_id : row.cover_letter_file_id) ??
    null
  );
}

export function validateApplicationDocument(file: File): void {
  if (file.size > APPLICATION_DOCUMENT_MAX_BYTES) {
    throw new Error("The file is too large (max 5 MB)");
  }
  if (file.type !== PDF_MIME_TYPE) {
    throw new Error("The file must be a PDF");
  }
}

/**
 * The name a document is stored under. The `resumes` bucket only accepts the
 * `pdf` extension by file name, while uploads are validated by MIME type, so
 * a PDF the device named "CV" (or "CV.PDF") would pass validation and then be
 * refused by Storage. Every stored file therefore ends in a lowercase `.pdf`;
 * a blank name falls back to `fallbackBase`.
 */
export function pdfStorageName(name: string, fallbackBase: string): string {
  const base = name.trim().replace(PDF_EXTENSION, "").trim();
  return `${base || fallbackBase}.pdf`;
}

/** Trim and cap the text pulled out of a cover-letter PDF. */
export function coverLetterTextForScreening(
  text: string | null | undefined
): string | null {
  const trimmed = text?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, COVER_LETTER_TEXT_MAX_CHARS);
}
