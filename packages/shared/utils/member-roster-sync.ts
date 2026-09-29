/**
 * Contract between the member-roster-sync Appwrite Function and the admin
 * `/members` status line, which reads the function's execution records.
 * Both sides must agree on these values, so they live here once.
 */

/**
 * Appwrite's maximum function timeout. A waiting/processing execution older
 * than this is stuck (e.g. a worker restart), not a live run: the function's
 * overlap guard and the admin "Refresh now" button both ignore it.
 */
export const STALE_EXECUTION_MS = 15 * 60 * 1000;

/**
 * Response status of a run that exited because another was already running.
 * The admin page treats other 2xx responses as a successful refresh.
 */
export const SKIPPED_STATUS_CODE = 409;
