import type { PrivateValueSource } from "./types";

/**
 * Builds the source once and reuses it, so the source's own cache and
 * single-flight survive across requests. A throwing factory is not cached, so
 * a config fix or a retry is picked up and the error still reads as
 * `unavailable` in the handler.
 */
export function memoizeSource(
  factory: () => PrivateValueSource | null
): () => PrivateValueSource | null {
  let cached: PrivateValueSource | null | undefined;
  return () => {
    if (cached === undefined) {
      cached = factory();
    }
    return cached;
  };
}
