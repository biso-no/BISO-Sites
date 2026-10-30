export interface RedirectRule {
  destination: string;
  source: string;
}

const WILDCARD_SUFFIX = "/:path*";
const TRAILING_SLASH = /\/+$/;

function normalize(url: string): string {
  const trimmed = url.replace(TRAILING_SLASH, "");
  return trimmed === "" ? "/" : trimmed;
}

function matches(source: string, url: string): boolean {
  if (source.endsWith(WILDCARD_SUFFIX)) {
    const base = source.slice(0, -WILDCARD_SUFFIX.length);
    return url === base || url.startsWith(`${base}/`);
  }
  return normalize(source) === url;
}

/** Destination of the first matching rule, or null. Mirrors Next's `:path*`. */
export function matchRedirect(
  url: string,
  rules: RedirectRule[]
): string | null {
  const normalized = normalize(url);
  for (const rule of rules) {
    if (matches(rule.source, normalized)) {
      return rule.destination;
    }
  }
  return null;
}
