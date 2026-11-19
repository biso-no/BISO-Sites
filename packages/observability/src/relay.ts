/** Largest Sentry envelope the browser tunnel forwards. */
export const MAX_RELAY_BYTES = 10 * 1024 * 1024;

/**
 * True when the request declares a body above the cap. A missing or
 * non-numeric `Content-Length` is not decided here: the SDK's tunnel handler
 * already answers those with 411.
 */
export function relayTooLarge(request: Request): boolean {
  const length = Number(request.headers.get("content-length"));
  return Number.isFinite(length) && length > MAX_RELAY_BYTES;
}
