/** A stand-in origin: `.invalid` can never be a real host. */
const BASE = "https://docs.invalid";

const BACKSLASH = "\\";
const LAST_CONTROL_CHAR = 0x1f;
const DELETE_CHAR = 0x7f;

function hasUnsafeChar(url: string): boolean {
  if (url.includes(BACKSLASH)) {
    return true;
  }
  for (const char of url) {
    const code = char.charCodeAt(0);
    if (code <= LAST_CONTROL_CHAR || code === DELETE_CHAR) {
      return true;
    }
  }
  return false;
}

/**
 * The url as a path on this site, or null when a browser could resolve it to
 * another origin. A plain prefix check isn't enough: browsers read `/\host`
 * as `//host` and drop tabs and newlines, so `/<TAB>/host` leaves the site.
 */
export function sitePath(url: string): string | null {
  if (!url.startsWith("/") || hasUnsafeChar(url)) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(url, BASE);
  } catch {
    return null;
  }
  if (resolved.origin !== BASE) {
    return null;
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}
