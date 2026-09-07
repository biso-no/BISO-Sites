/**
 * HTML-escaping helpers for values interpolated into transactional email
 * bodies. Shared by every server-side sender so a single implementation is
 * audited once (`/api/form/submit`, the varsling whistleblowing action, …).
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ESCAPE_PATTERN = /[&<>"']/g;
const NEWLINE_PATTERN = /\r?\n/g;

/** Escape the five HTML-significant characters. */
export function escapeHtml(value: string): string {
  return value.replace(HTML_ESCAPE_PATTERN, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * Coerce an arbitrary value to a string and clamp it to `max` characters so a
 * hostile payload can't blow up the message body.
 */
export function clampString(value: unknown, max: number): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/**
 * Escape first, then convert newlines to `<br>`. Never reverse the order —
 * escaping after the replace would neutralise the `<br>` tags, and replacing
 * before escaping lets the source text inject markup.
 */
export function escapeHtmlMultiline(value: string): string {
  return escapeHtml(value).replace(NEWLINE_PATTERN, "<br>");
}
