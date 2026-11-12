// Control characters, quotes and backslashes would end or split the header.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const HEADER_BREAKING_CHARS = /[\u0000-\u001F\u007F"\\]/g;
const NON_ASCII = /[^\x20-\x7E]/g;
// encodeURIComponent leaves these as is, but RFC 5987 attr-char excludes them.
const NON_ATTR_CHARS = /['()*]/g;
const FALLBACK_NAME = "download";

function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    NON_ATTR_CHARS,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * An RFC 6266 `Content-Disposition` value that is safe for any file name.
 *
 * Header values must be ASCII. A raw "ø" makes Appwrite Sites drop the
 * response headers (the browser then shows a PDF as text), and anything past
 * U+00FF makes the `Headers` constructor throw. So `filename` gets an ASCII
 * fallback and `filename*` (RFC 5987) carries the real name, which every
 * current browser prefers.
 */
export function contentDisposition(
  type: "inline" | "attachment",
  fileName: string
): string {
  const name =
    fileName.replace(HEADER_BREAKING_CHARS, "_").trim() || FALLBACK_NAME;
  const asciiName = name.replace(NON_ASCII, "_");
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodeRfc5987(name)}`;
}
