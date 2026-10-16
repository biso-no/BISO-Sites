/**
 * The camera keeps decoding while a result is on screen, and a web pass
 * rotates to a new code every 30 s. To avoid logging the same pass twice,
 * repeat sightings are keyed by the member id inside the code rather than
 * the exact code string.
 *
 * Client-safe: parses the code shape only, never verifies it.
 */

/** A pass seen again within this long of its last sighting is ignored. */
export const REPEAT_WINDOW_MS = 20_000;

export interface Sighting {
  at: number;
  key: string;
}

/** Number of dot-separated parts after the user id, per code prefix. */
const TRAILING_PARTS: Record<string, number> = { a1: 2, g1: 1, v1: 2 };

/**
 * The member id for `v1`/`a1`/`g1` codes, or the whole trimmed string when
 * the code does not parse (so unknown codes fall back to exact matching).
 */
export function scanRepeatKey(code: string): string {
  const trimmed = code.trim();
  const parts = trimmed.split(".");
  const prefix = parts[0] ?? "";
  const trailing = Object.hasOwn(TRAILING_PARTS, prefix)
    ? TRAILING_PARTS[prefix]
    : undefined;
  if (trailing === undefined) {
    return trimmed;
  }
  const userId = parts.slice(1, -trailing).join(".");
  return userId ? `member:${userId}` : trimmed;
}

/**
 * Records a sighting of `code` at `now`. `repeat` is true when the same
 * pass was last seen less than REPEAT_WINDOW_MS ago; the returned
 * `sighting` restarts the window either way.
 */
export function recordSighting(
  last: Sighting | null,
  code: string,
  now: number
): { repeat: boolean; sighting: Sighting } {
  const key = scanRepeatKey(code);
  const repeat =
    last !== null && last.key === key && now - last.at < REPEAT_WINDOW_MS;
  return { repeat, sighting: { at: now, key } };
}
