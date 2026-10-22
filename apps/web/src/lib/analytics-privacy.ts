/**
 * Keeps sign-in secrets out of Umami.
 *
 * Umami records each page's full URL and the page it came from. The app's
 * emailed sign-in link opens `/auth/verify?userId=…&secret=…` when it lands in
 * a browser, and that secret is still valid there, so `/auth/` pages are
 * recorded without their query string. Everywhere else the query string is
 * kept: campaign links rely on their `utm_*` parameters.
 *
 * Umami calls the function named by the tracker's `data-before-send`
 * attribute, looked up on `window`, before every send.
 */
export const UMAMI_BEFORE_SEND = "bisoUmamiBeforeSend";

const AUTH_PATH = "/auth";
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;
/** Only resolves path-only URLs; never part of a returned value. */
const PARSE_BASE = "https://biso.no";

function isAuthPath(pathname: string): boolean {
  return pathname === AUTH_PATH || pathname.startsWith(`${AUTH_PATH}/`);
}

/**
 * `url` without its query string (and fragment) when it points at an `/auth/`
 * page, otherwise unchanged. Takes a full URL, as this Umami version sends, or
 * a path, as older versions did, and returns the same form.
 */
export function withoutAuthQuery(url: string): string {
  if (!url) {
    return url;
  }
  let parsed: URL;
  try {
    parsed = new URL(url, PARSE_BASE);
  } catch {
    return url;
  }
  if (!(isAuthPath(parsed.pathname) && (parsed.search || parsed.hash))) {
    return url;
  }
  parsed.search = "";
  parsed.hash = "";
  return HAS_SCHEME.test(url) ? parsed.toString() : parsed.pathname;
}

/**
 * The `data-before-send` hook: scrubs the page URL and the referrer (which,
 * after a client-side navigation, is the previous page's full URL) of every
 * payload. It never cancels a send.
 */
export function umamiBeforeSend<T>(_type: string, payload: T): T {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const { referrer, url } = payload as { referrer?: unknown; url?: unknown };
  return {
    ...payload,
    ...(typeof referrer === "string" && {
      referrer: withoutAuthQuery(referrer),
    }),
    ...(typeof url === "string" && { url: withoutAuthQuery(url) }),
  };
}
