/**
 * The pause before a row event reads anything. An admin save writes several
 * rows in a row (publishing a page updates each `page_translations` row, then
 * the `pages` row), and each write starts its own execution. Executions run
 * in parallel and can finish out of order, so one that reads too early can
 * write an older state after a later one wrote the newer. Waiting lets the
 * save finish first, so every execution reads the final rows.
 */
export const DEFAULT_SETTLE_MS = 2000;

const WHOLE_NUMBER = /^\d+$/;

/** `SYNC_SETTLE_MS`: whole milliseconds, 0 for no pause, else the default. */
export function settleDelayMs(raw: string | undefined): number {
  const value = raw?.trim() ?? "";
  return WHOLE_NUMBER.test(value) ? Number(value) : DEFAULT_SETTLE_MS;
}

type Sleep = (ms: number) => Promise<void>;

const sleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The wait a row event runs before it reads; no timer at all for 0. */
export function settleFor(
  ms: number,
  wait: Sleep = sleep
): () => Promise<void> {
  return ms > 0 ? () => wait(ms) : () => Promise.resolve();
}
