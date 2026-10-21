/** An execution older than this is treated as stuck, not running. */
export const STALE_EXECUTION_MS = 15 * 60 * 1000;

/** The execution fields the overlap guard reads. */
export interface ExecutionSummary {
  $createdAt: string;
  $id: string;
  status: string;
  trigger: string;
}

/** Event executions only maintain locks, so they never count as dispatch runs. */
const DISPATCH_TRIGGERS = new Set(["http", "schedule"]);
const RUNNING_STATUSES = new Set(["waiting", "processing"]);

/**
 * Whether another dispatch run is in flight. Two concurrent runs could push
 * the same item twice, so a run that finds another one skips.
 *
 * `selfId` is the current execution's id (`x-appwrite-execution-id`). Without
 * it the list cannot be told apart from "me", so the run counts itself and is
 * busy only when more than one dispatch execution is running.
 */
export function isAnotherDispatchRunning(
  executions: ExecutionSummary[],
  selfId: string | undefined,
  now: Date
): boolean {
  const cutoff = now.getTime() - STALE_EXECUTION_MS;
  const running = executions.filter(
    (execution) =>
      DISPATCH_TRIGGERS.has(execution.trigger) &&
      RUNNING_STATUSES.has(execution.status) &&
      new Date(execution.$createdAt).getTime() > cutoff
  );
  if (selfId) {
    return running.some((execution) => execution.$id !== selfId);
  }
  return running.length > 1;
}
