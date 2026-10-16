/**
 * Error classification for Appwrite calls.
 *
 * `.catch(() => null)` around a read turns every failure — a timeout, a 401, an
 * outage — into "not found", and the caller then answers 404/409/200-empty for
 * what was really a 5xx. These helpers keep "the row doesn't exist" apart from
 * "the backend failed" so callers can pick the right status.
 *
 * Duck-typed on `code` so it works for both `appwrite` and `node-appwrite`
 * exceptions (they are distinct classes).
 */

const MIN_HTTP_ERROR = 400;
const MAX_HTTP_ERROR = 599;
const NOT_FOUND = 404;

function errorCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "number" ? code : undefined;
}

/** True only when Appwrite answered 404. Anything else is a real failure. */
export function isNotFound(error: unknown): boolean {
  return errorCode(error) === NOT_FOUND;
}

/**
 * The HTTP status Appwrite reported for this error, or `undefined` when the
 * error did not come from an HTTP response (network failure, bug, etc.).
 */
export function appwriteErrorStatus(error: unknown): number | undefined {
  const code = errorCode(error);
  if (code === undefined || code < MIN_HTTP_ERROR || code > MAX_HTTP_ERROR) {
    return;
  }
  return code;
}

/**
 * Resolves to `null` when the awaited read 404s and rethrows every other
 * error. Use instead of `.catch(() => null)`:
 *
 *   const row = await orNullIfNotFound(db.getRow<T>({ ... }));
 */
export async function orNullIfNotFound<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}
