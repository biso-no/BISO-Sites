import type { FrameRatio } from "@/editor/types";
import { knownKey } from "./known-key";

const VIMEO_RE = /vimeo\.com\/(\d+)/;
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
/** Appwrite storage's `…/v1/storage/buckets/<bucket>/files/<id>/view?…`. */
const APPWRITE_VIEW_RE =
  /^([^?#]*\/v1\/storage\/buckets\/[^/?#]+\/files\/[^/?#]+)\/view(\?[^#]*)?$/;
/** Formats the preview endpoint would flatten: SVG (an icon) and GIF (one frame). */
const UNSIZED_MIME_RE = /^image\/(?:svg\+xml|gif)$/i;
const UNSIZED_PATH_RE = /\.(?:svg|gif)$/i;
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
  const match = APPWRITE_VIEW_RE.exec(src);
  if (!match) {
    return src;
  }
  const query = match[2] ? `${match[2]}&` : "?";
  return `${match[1]}/preview${query}width=${width}&output=webp&quality=80`;
}

/**
 * An Appwrite storage `…/<id>/view?…` URL as its `…/<id>/download?…` twin
 * (the same file, served as an attachment), or null for any other URL.
 */
export function appwriteDownloadSrc(src: string): string | null {
  const match = APPWRITE_VIEW_RE.exec(src);
  return match ? `${match[1]}/download${match[2] ?? ""}` : null;
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
