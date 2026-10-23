/** Editor-supplied links are untrusted: only these shapes become a live `<a>`. */
export const EXTERNAL_RE = /^https?:\/\//i;

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point.
const IGNORED_CHARS = /[\u0000- \u007f-\u009f]/g;
const RELATIVE_RE = /^(?:\/|#|\?|\.\/|\.\.\/)/;
const SAFE_SCHEME_RE = /^(?:https?|mailto|tel):/i;

/**
 * The href when it is a relative path or an http(s), mailto or tel link,
 * otherwise null (javascript:, data:, blank, anything else).
 */
export function safeHref(href: string | undefined): string | null {
  if (!href) {
    return null;
  }
  const trimmed = href.trim();
  // Browsers drop whitespace and control characters inside a scheme.
  const probe = trimmed.replace(IGNORED_CHARS, "");
  if (!probe) {
    return null;
  }
  if (RELATIVE_RE.test(probe) || SAFE_SCHEME_RE.test(probe)) {
    return trimmed;
  }
  return null;
}

/** `rel` and `target` for links that leave the site. */
export function externalLinkProps(
  href: string
): { rel: "noopener"; target: "_blank" } | Record<string, never> {
  return EXTERNAL_RE.test(href.trim())
    ? { rel: "noopener", target: "_blank" }
    : {};
}
