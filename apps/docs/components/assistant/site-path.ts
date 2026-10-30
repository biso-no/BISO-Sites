/**
 * A docs page path: lowercase slugs between single slashes, and optionally a
 * heading or step anchor, as in `/guide/shop/add-a-product#start-a-product`.
 * The anchor also allows `_`, because a Fumadocs heading id keeps one from
 * the heading's text (`#credentials-the-payment_settings-table`).
 *
 * An allowlist, so dot segments, double slashes, backslashes, control
 * characters, percent-encoding, queries and absolute URLs can't get through.
 * A browser would resolve several of those to another origin.
 */
const DOCS_PATH = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?(?:#[a-z0-9_-]+)?$/;

/** The url unchanged when it is a docs page path, otherwise null. */
export function sitePath(url: string): string | null {
  return DOCS_PATH.test(url) ? url : null;
}
