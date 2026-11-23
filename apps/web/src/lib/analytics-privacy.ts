/**
 * Keeps sign-in secrets and search queries out of Umami.
 *
 * Umami records each page's full URL and the page it came from. The app's
 * emailed sign-in link opens `/auth/verify?userId=…&secret=…` when it lands in
 * a browser, and that secret is still valid there, so `/auth/` pages are
 * recorded without their query string. `/search` pages are too: the query is
 * what the visitor typed, which can be a name. Everywhere else the query string is
 * kept: campaign links rely on their `utm_*` parameters.
 *
 * Umami calls the function named by the tracker's `data-before-send`
 * attribute, looked up on `window`, before every send.
 */
export const UMAMI_BEFORE_SEND = "bisoUmamiBeforeSend";

const AUTH_PATH = "/auth";
const SEARCH_PATH = "/search";
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;
/** Only resolves path-only URLs; never part of a returned value. */
const PARSE_BASE = "https://biso.no";

function isSensitivePath(pathname: string): boolean {
  return (
    pathname === AUTH_PATH ||
    pathname.startsWith(`${AUTH_PATH}/`) ||
    // The query is what the visitor typed, which can be a name.
    pathname === SEARCH_PATH ||
    pathname.startsWith(`${SEARCH_PATH}/`)
  );
}

/**
 * `url` without its query string (and fragment) when it points at an `/auth/`
 * or `/search` page, otherwise unchanged. Takes a full URL, as this Umami
 * version sends, or a path, as older versions did, and returns the same form.
 */
export function withoutSensitiveQuery(url: string): string {
  if (!url) {
    return url;
  }
  let parsed: URL;
  try {
    parsed = new URL(url, PARSE_BASE);
  } catch {
    return url;
  }
  if (!(isSensitivePath(parsed.pathname) && (parsed.search || parsed.hash))) {
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
      referrer: withoutSensitiveQuery(referrer),
    }),
    ...(typeof url === "string" && { url: withoutSensitiveQuery(url) }),
  };
}
