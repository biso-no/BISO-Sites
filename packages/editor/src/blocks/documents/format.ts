import { safeHref } from "@/blocks/_v2/links";
import {
  APPWRITE_ENDPOINT,
  APPWRITE_PROJECT,
  appwriteDownloadSrc,
} from "@/blocks/_v2/media";
import type { DocumentItem, EditorLocale } from "@/editor/types";

const KB = 1000;
const MB = KB * KB;
const MEDIA_BUCKET = "media";
const ID_RE = /^[A-Za-z0-9._-]{1,36}$/;
const EXTENSION_RE = /\.([a-z0-9]{1,5})(?:[?#]|$)/i;
const SEPARATOR_RE = /[_]+/g;

const NUMBER_LOCALE: Record<EditorLocale, string> = {
  en: "en-US",
  no: "nb-NO",
};

const WORD_X =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const EXCEL_X =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const POWERPOINT_X =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const MIME_LABELS: Record<string, string> = {
  "application/msword": "Word",
  "application/pdf": "PDF",
  "application/vnd.ms-excel": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint",
  [EXCEL_X]: "Excel",
  [POWERPOINT_X]: "PowerPoint",
  [WORD_X]: "Word",
  "text/csv": "CSV",
  "text/plain": "TXT",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  doc: "application/msword",
  docx: WORD_X,
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: POWERPOINT_X,
  txt: "text/plain",
  xls: "application/vnd.ms-excel",
  xlsx: EXCEL_X,
};

const ACTION: Record<EditorLocale, string> = {
  en: "Download",
  no: "Last ned",
};
const UNKNOWN_TYPE: Record<EditorLocale, string> = {
  en: "File",
  no: "Fil",
};

const text = (value: unknown): string =>
  typeof value === "string" ? value : "";

const lookup = (table: Record<string, string>, key: string): string | null =>
  Object.hasOwn(table, key) ? (table[key] ?? null) : null;

/**
 * "1,2 MB", "340 kB", "512 B" with the page language's decimals (SI units,
 * as Finder and Norwegian practice have it). Null for a size that is not a
 * positive number, so the row shows the type alone instead of "0 B".
 */
export function formatFileSize(
  bytes: unknown,
  locale: EditorLocale = "no"
): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  const number = new Intl.NumberFormat(NUMBER_LOCALE[locale], {
    maximumFractionDigits: 1,
  });
  if (bytes < KB) {
    return `${number.format(Math.round(bytes))} B`;
  }
  const kilobytes = Math.round((bytes / KB) * 10) / 10;
  if (kilobytes < KB) {
    return `${number.format(kilobytes)} kB`;
  }
  return `${number.format(bytes / MB)} MB`;
}

/** The document type a file name's extension stands for, if it is one. */
export function mimeFromFilename(name: string): string | undefined {
  const extension = EXTENSION_RE.exec(name)?.[1]?.toLowerCase();
  return extension && Object.hasOwn(MIME_BY_EXTENSION, extension)
    ? MIME_BY_EXTENSION[extension]
    : undefined;
}

/** "PDF", "Word", … from the mime, else the link's or title's extension. */
export function fileTypeLabel(
  item: Partial<DocumentItem>,
  locale: EditorLocale = "no"
): string {
  const fromMime = lookup(MIME_LABELS, text(item.mime).toLowerCase());
  if (fromMime) {
    return fromMime;
  }
  for (const source of [text(item.src), text(item.title)]) {
    const mime = mimeFromFilename(source);
    const label = mime ? lookup(MIME_LABELS, mime) : null;
    if (label) {
      return label;
    }
  }
  return UNKNOWN_TYPE[locale];
}

/** "PDF · 1,2 MB", or "PDF" when the size is unknown. */
export function metaLine(
  item: Partial<DocumentItem>,
  locale: EditorLocale = "no"
): string {
  return [fileTypeLabel(item, locale), formatFileSize(item.size, locale)]
    .filter(Boolean)
    .join(" · ");
}

/** "Last ned Vedtekter (PDF, 1,2 MB)": names the link by what it fetches. */
export function accessibleName(
  item: Partial<DocumentItem>,
  locale: EditorLocale = "no"
): string {
  const details = [
    fileTypeLabel(item, locale),
    formatFileSize(item.size, locale),
  ]
    .filter(Boolean)
    .join(", ");
  return `${ACTION[locale]} ${text(item.title).trim()} (${details})`;
}

export const downloadLabel = (locale: EditorLocale): string => ACTION[locale];

/**
 * Where the row's link goes: the Appwrite download endpoint for an uploaded
 * file, otherwise the link itself when it is safe. Null when there is nothing
 * safe to link to.
 */
export function downloadHref(item: Partial<DocumentItem>): string | null {
  const src = text(item.src).trim();
  const fileId = text(item.fileId).trim();
  // A link wins over a file id; the id only stands in when there is no link.
  let href: string | null = src ? (appwriteDownloadSrc(src) ?? src) : null;
  if (!src && ID_RE.test(fileId)) {
    // Mirrors `getStorageFileDownloadUrl("media", id)` in @repo/api, which the
    // editor package does not depend on.
    href = `${APPWRITE_ENDPOINT}/storage/buckets/${MEDIA_BUCKET}/files/${fileId}/download?project=${APPWRITE_PROJECT}`;
  }
  // Whatever was built, only a safe link reaches an `<a>`.
  return safeHref(href);
}

/** A file name as a title: no extension, underscores as spaces. */
export function titleFromFilename(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.replace(SEPARATOR_RE, " ").trim();
}
