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
  Record<string, { mediaKind: InlineMediaKind; mimeTypes: readonly string[] }>
> = {
  gif: { mediaKind: "image", mimeTypes: ["image/gif"] },
  jpeg: { mediaKind: "image", mimeTypes: ["image/jpeg"] },
  jpg: { mediaKind: "image", mimeTypes: ["image/jpeg"] },
  mp3: { mediaKind: "audio", mimeTypes: ["audio/mpeg"] },
  mp4: { mediaKind: "video", mimeTypes: ["video/mp4"] },
  ogg: { mediaKind: "audio", mimeTypes: ["audio/ogg"] },
  pdf: { mediaKind: "file", mimeTypes: ["application/pdf"] },
  png: { mediaKind: "image", mimeTypes: ["image/png"] },
  wav: { mediaKind: "audio", mimeTypes: ["audio/wav"] },
  webm: { mediaKind: "video", mimeTypes: ["video/webm"] },
  webp: { mediaKind: "image", mimeTypes: ["image/webp"] },
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

  const mediaType = EXTENSION_MEDIA_TYPES[extension];
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (!mediaType?.mimeTypes.includes(normalizedMimeType)) {
    return null;
  }

  return mediaType.mediaKind;
}

export function sanitizeInlineMediaFilename(fileName: string): string {
  const cleaned = fileName
    .replace(FILENAME_REGEX, "_")
    .slice(0, MAX_FILENAME_LENGTH);
  return cleaned || "upload";
}
