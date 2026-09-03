const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
/**
 * How often a running branch prints a line. Long enough that the 14k-order
 * branch does not bury the error lines it interleaves with, short enough that
 * a stalled load is obvious within a couple of seconds.
 */
const DEFAULT_INTERVAL_MS = 2000;
const PERCENT = 100;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / MS_PER_SECOND));
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
    return `${minutes}m ${totalSeconds % SECONDS_PER_MINUTE}s`;
  }
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor(
    (totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE
  );
  return `${hours}h ${minutes}m`;
}

export interface ProgressReporterOptions {
  /** Throttle between lines. Defaults to DEFAULT_INTERVAL_MS. */
  intervalMs?: number;
  /** Content type being loaded, e.g. "orders". */
  label: string;
  log?: (line: string) => void;
  /** Injectable clock, so tests do not depend on wall time. */
  now?: () => number;
  total: number;
}

export interface ProgressReporter {
  /** Emits the final line unconditionally, with the total elapsed time. */
  finish: () => void;
  /** Records one finished row; may emit a line if the throttle allows. */
  record: (ok: boolean) => void;
}

/**
 * Prints how a load branch is progressing.
 *
 * Rows complete out of order and in parallel, so per-row lines would be both
 * noisy and misleading — 14k of them for orders. This aggregates instead:
 * how many are done, how fast, and how much longer, throttled to one line
 * every couple of seconds.
 */
export function createProgressReporter(
  options: ProgressReporterOptions
): ProgressReporter {
  const now = options.now ?? Date.now;
  const log = options.log ?? console.log;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const startedAt = now();

  let completed = 0;
  let failed = 0;
  let lastEmittedAt = startedAt;

  const emit = (finished: boolean): void => {
    const elapsedMs = now() - startedAt;
    // A zero total is complete by definition; anything else would divide by it.
    const percent =
      options.total === 0
        ? PERCENT
        : Math.floor((completed / options.total) * PERCENT);

    const parts = [
      `  ${options.label} ${completed}/${options.total} (${percent}%)`,
    ];
    const detail: string[] = [];

    if (finished) {
      detail.push(`done in ${formatDuration(elapsedMs)}`);
    } else if (elapsedMs > 0 && completed > 0) {
      const rowsPerSecond = completed / (elapsedMs / MS_PER_SECOND);
      detail.push(`${Math.round(rowsPerSecond)} rows/s`);
      const remaining = options.total - completed;
      if (remaining > 0) {
        detail.push(
          `~${formatDuration((remaining / rowsPerSecond) * MS_PER_SECOND)} left`
        );
      }
    }
    if (failed > 0) {
      detail.push(`${failed} failed`);
    }

    if (detail.length > 0) {
      parts.push(` — ${detail.join(", ")}`);
    }
    log(parts.join(""));
    lastEmittedAt = now();
  };

  return {
    finish: () => emit(true),
    record: (ok: boolean) => {
      completed += 1;
      if (!ok) {
        failed += 1;
      }
      if (now() - lastEmittedAt >= intervalMs) {
        emit(false);
      }
    },
  };
}
