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

/** Height over width, for `--ar`. */
export function ratioValue(ratio: FrameRatio): number {
  const [w, h] = ratio.split("/").map(Number);
  return h / w;
}
