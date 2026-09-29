/**
 * Derives the roster page's status line from the sync function's own
 * execution records (Appwrite keeps them; there is no separate state table).
 * A run "succeeded" only when it completed with a non-error response — the
 * function returns 500 on failure, which Appwrite still records as completed.
 */

export interface ExecutionLike {
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

function succeeded(execution: ExecutionLike): boolean {
  return (
    execution.status === "completed" &&
    execution.responseStatusCode < HTTP_ERROR_THRESHOLD
  );
}

/** `executions` must be ordered newest first. */
export function summarizeRosterExecutions(
  executions: ExecutionLike[]
): RosterStatus {
  const running = executions.some((e) => RUNNING_STATUSES.has(e.status));
  const finished = executions.filter((e) => !RUNNING_STATUSES.has(e.status));
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
