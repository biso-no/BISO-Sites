/**
 * Derives the roster page's status line from the sync function's own
 * execution records (Appwrite keeps them; there is no separate state table).
 * A run "succeeded" only when it completed with a non-error response — the
 * function returns 500 on failure, which Appwrite still records as completed,
 * and 409 when it skipped because another run was in progress.
 */

export interface ExecutionLike {
  $createdAt?: string;
  $updatedAt: string;
  responseStatusCode: number;
  status: string;
}

export interface RosterStatus {
  lastFailedAt: string | null;
  lastRefreshedAt: string | null;
  running: boolean;
}

const RUNNING_STATUSES = new Set(["waiting", "processing"]);
const HTTP_ERROR_THRESHOLD = 400;
/** Response of a run that exited because another was already running. */
export const SKIPPED_STATUS_CODE = 409;
/**
 * Appwrite's maximum function timeout. A waiting/processing record older than
 * this is a stuck execution (e.g. a worker restart), not a live run — trusting
 * it would disable "Refresh now" and skip every nightly run indefinitely.
 */
export const STALE_EXECUTION_MS = 15 * 60 * 1000;

function succeeded(execution: ExecutionLike): boolean {
  return (
    execution.status === "completed" &&
    execution.responseStatusCode < HTTP_ERROR_THRESHOLD
  );
}

function isSkipped(execution: ExecutionLike): boolean {
  return (
    execution.status === "completed" &&
    execution.responseStatusCode === SKIPPED_STATUS_CODE
  );
}

function isLive(execution: ExecutionLike, now: number): boolean {
  if (!RUNNING_STATUSES.has(execution.status)) {
    return false;
  }
  const createdAt = Date.parse(execution.$createdAt ?? "");
  return Number.isNaN(createdAt) || now - createdAt < STALE_EXECUTION_MS;
}

/** `executions` must be ordered newest first. */
export function summarizeRosterExecutions(
  executions: ExecutionLike[],
  now: number = Date.now()
): RosterStatus {
  const running = executions.some((e) => isLive(e, now));
  const finished = executions.filter(
    (e) => !(RUNNING_STATUSES.has(e.status) || isSkipped(e))
  );
  const lastSuccessIndex = finished.findIndex(succeeded);
  // Only failures newer than the last success are worth showing.
  const newerFinished =
    lastSuccessIndex === -1 ? finished : finished.slice(0, lastSuccessIndex);

  return {
    lastFailedAt: newerFinished[0]?.$updatedAt ?? null,
    lastRefreshedAt: finished[lastSuccessIndex]?.$updatedAt ?? null,
    running,
  };
}
