/**
 * `JSON.stringify` leaves `<` and `>` intact, so editor-controlled text that
 * contains `</script>` would close the surrounding element and let whatever
 * follows execute in the reader's browser. Escaping the HTML-significant
 * characters as `\uXXXX` keeps the JSON semantically identical while making it
 * inert to the HTML parser. U+2028/U+2029 are legal in JSON but not in JS
 * string literals, so they are escaped for the same reason.
 */
const HTML_UNSAFE_PATTERN = /[<>&\u2028\u2029]/g;

const HTML_UNSAFE_ESCAPES: Record<string, string> = {
  "&": "\\u0026",
  "<": "\\u003c",
  ">": "\\u003e",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

/** Serialize a JSON-LD payload for embedding in a `<script>` element. */
export function serializeJsonLd(payload: unknown): string {
  return JSON.stringify(payload).replace(
    HTML_UNSAFE_PATTERN,
    (character) => HTML_UNSAFE_ESCAPES[character] ?? character
  );
}
