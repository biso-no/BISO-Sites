import type { FrameRatio } from "@/editor/types";

const VIMEO_RE = /vimeo\.com\/(\d+)/;
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const APPWRITE_VIEW_RE = /^(.*\/files\/[^/?#]+)\/view(\?[^#]*)?$/;

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
  const vimeo = youtube ? null : url.match(VIMEO_RE);
  let base: string;
  if (youtube) {
    base = `https://www.youtube.com/embed/${youtube[1]}`;
  } else if (vimeo) {
    base = `https://player.vimeo.com/video/${vimeo[1]}`;
  } else {
    return null;
  }
  return autoplay ? `${base}?autoplay=1&mute=1` : base;
}

/**
 * An Appwrite storage `…/files/<id>/view?…` URL becomes a resized WebP
 * `…/preview?…`. Any other URL is returned unchanged.
 */
export function sizedImageSrc(src: string, width: number): string {
  const match = APPWRITE_VIEW_RE.exec(src);
  if (!match) {
    return src;
  }
  const query = match[2] ? `${match[2]}&` : "?";
  return `${match[1]}/preview${query}width=${width}&output=webp&quality=80`;
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
  const known = ratio && RATIO_VALUES[ratio];
  return known || RATIO_VALUES[DEFAULT_RATIO];
}
