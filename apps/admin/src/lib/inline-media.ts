export const INLINE_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export type InlineMediaKind = "audio" | "file" | "image" | "video";

export interface InlineMediaUpload {
  fileId: string;
  fileName: string;
  mediaKind: InlineMediaKind;
  mimeType: string;
  size: number;
  url: string;
}

const EXTENSION_MEDIA_TYPES: Readonly<
  Record<string, Readonly<Record<string, InlineMediaKind>>>
> = {
  csv: { "text/csv": "file" },
  doc: { "application/msword": "file" },
  docx: {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "file",
  },
  gif: { "image/gif": "image" },
  jpeg: { "image/jpeg": "image" },
  jpg: { "image/jpeg": "image" },
  m4a: { "audio/mp4": "audio", "audio/x-m4a": "audio" },
  mov: { "video/quicktime": "video" },
  mp3: { "audio/mpeg": "audio" },
  mp4: { "audio/mp4": "audio", "video/mp4": "video" },
  ogg: { "audio/ogg": "audio" },
  pdf: { "application/pdf": "file" },
  png: { "image/png": "image" },
  ppt: { "application/vnd.ms-powerpoint": "file" },
  pptx: {
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "file",
  },
  svg: { "image/svg+xml": "image" },
  txt: { "text/plain": "file" },
  wav: { "audio/wav": "audio" },
  webm: { "audio/webm": "audio", "video/webm": "video" },
  webp: { "image/webp": "image" },
  xls: { "application/vnd.ms-excel": "file" },
  xlsx: {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "file",
  },
  zip: { "application/zip": "file" },
};

const FILENAME_REGEX = /[^a-z0-9._-]/gi;
const MAX_FILENAME_LENGTH = 120;

export function classifyInlineMedia(
  fileName: string,
  mimeType: string
): InlineMediaKind | null {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  if (!extension) {
    return null;
  }

  const normalizedMimeType = mimeType.trim().toLowerCase();
  return EXTENSION_MEDIA_TYPES[extension]?.[normalizedMimeType] ?? null;
}

export function sanitizeInlineMediaFilename(fileName: string): string {
  const cleaned = fileName
    .replace(FILENAME_REGEX, "_")
    .slice(0, MAX_FILENAME_LENGTH);
  return cleaned || "upload";
}
