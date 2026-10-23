import type { FrameRatio } from "@/editor/types";
import { knownKey } from "./known-key";

const VIMEO_RE = /vimeo\.com\/(\d+)/;
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
/** Mirrors `packages/api/storage.ts`, which the editor does not depend on. */
export const APPWRITE_ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || "https://appwrite.biso.no/v1";
export const APPWRITE_PROJECT =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";
/** Appwrite's id charset and length. */
const APPWRITE_ID_RE = /^[A-Za-z0-9._-]{1,36}$/;
/** Formats the preview endpoint would flatten: SVG (an icon) and GIF (one frame). */
const UNSIZED_MIME_RE = /^image\/(?:svg\+xml|gif)$/i;
const UNSIZED_PATH_RE = /\.(?:svg|gif)$/i;
const TRAILING_SLASH_RE = /\/+$/;
const QUERY_OR_FRAGMENT_RE = /[?#]/;

/** True for a YouTube or Vimeo watch URL. */
export function isEmbedUrl(url: string): boolean {
  return YOUTUBE_RE.test(url) || VIMEO_RE.test(url);
}

/** The iframe `src` for a YouTube or Vimeo URL, or null for anything else. */
export function embedSrc(
  url: string,
  { autoplay = false }: { autoplay?: boolean } = {}
): string | null {
  const youtube = url.match(YOUTUBE_RE);
  if (youtube) {
    const base = `https://www.youtube-nocookie.com/embed/${youtube[1]}`;
    return autoplay ? `${base}?autoplay=1&mute=1` : base;
  }
  const vimeo = url.match(VIMEO_RE);
  if (vimeo) {
    // Vimeo's player reads `muted`, YouTube's `mute`.
    const base = `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`;
    return autoplay ? `${base}&autoplay=1&muted=1` : base;
  }
  return null;
}

/**
 * An Appwrite storage `…/v1/storage/buckets/<bucket>/files/<id>/view?…` URL
 * becomes a resized WebP `…/preview?…`. An SVG or GIF (by its uploaded `mime`
 * or its path) and any other URL are returned unchanged: the preview turns an
 * SVG into an icon and a GIF into one still frame.
 */
export function sizedImageSrc(
  src: string,
  width: number,
  mime?: string
): string {
  const path = src.split(QUERY_OR_FRAGMENT_RE, 1)[0] ?? "";
  if (
    (typeof mime === "string" && UNSIZED_MIME_RE.test(mime)) ||
    UNSIZED_PATH_RE.test(path)
  ) {
    return src;
  }
  const file = parseAppwriteFileUrl(src);
  if (!file) {
    return src;
  }
  const query = file.search ? `${file.search}&` : "?";
  return `${file.base}/preview${query}width=${width}&output=webp&quality=80`;
}

/**
 * An Appwrite storage `<endpoint>/storage/buckets/<bucket>/files/<id>/view`
 * URL on the configured endpoint, parsed. Anything else (another host, a
 * `javascript:` or `data:` string that merely ends in the same path, ids
 * outside Appwrite's charset, a fragment) is null.
 */
function parseAppwriteFileUrl(
  src: string
): { base: string; bucket: string; search: string } | null {
  let url: URL;
  let endpoint: URL;
  try {
    url = new URL(src);
    endpoint = new URL(APPWRITE_ENDPOINT);
  } catch {
    return null;
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.origin !== endpoint.origin ||
    url.username ||
    url.password ||
    url.hash
  ) {
    return null;
  }
  const prefix = `${endpoint.pathname.replace(TRAILING_SLASH_RE, "")}/storage/buckets/`;
  if (!url.pathname.startsWith(prefix)) {
    return null;
  }
  const [bucket, files, id, action, ...rest] = url.pathname
    .slice(prefix.length)
    .split("/");
  if (
    files !== "files" ||
    action !== "view" ||
    rest.length > 0 ||
    !(bucket && id && APPWRITE_ID_RE.test(bucket) && APPWRITE_ID_RE.test(id))
  ) {
    return null;
  }
  return {
    base: `${url.origin}${prefix}${bucket}/files/${id}`,
    bucket,
    search: url.search,
  };
}

/**
 * A media-bucket file URL on the Appwrite endpoint as its `…/download?…`
 * twin (the same file, served as an attachment); null for any other URL.
 */
export function appwriteDownloadSrc(src: string): string | null {
  const file = parseAppwriteFileUrl(src);
  return file && file.bucket === "media"
    ? `${file.base}/download${file.search}`
    : null;
}

const DEFAULT_RATIO: FrameRatio = "16/9";
const RATIO_VALUES: Record<FrameRatio, number> = {
  "21/9": 9 / 21,
  "16/9": 9 / 16,
  "3/2": 2 / 3,
  "4/3": 3 / 4,
  "1/1": 1,
  "4/5": 5 / 4,
  "3/4": 4 / 3,
};

/**
 * Height over width, for `--ar`. Anything that is not a known ratio (old page
 * data, copilot output) falls back to 16/9 rather than crashing the page.
 */
export function ratioValue(ratio: FrameRatio | undefined): number {
  return RATIO_VALUES[knownKey(RATIO_VALUES, ratio, DEFAULT_RATIO)];
}
