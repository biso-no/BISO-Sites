import type { EditorLocale, PageDoc, StoredMeta } from "@/editor/types";

/** How a document reaches the host: its `savePage`, or its `onFlush`. */
export type SaveTo = (
  doc: PageDoc,
  locale: EditorLocale
) => Promise<StoredMeta | undefined>;

/**
 * One autosave, ready to run. `to` replaces the host's usual save (the
 * last-chance save on unmount or page hide). Resolves true once the document
 * is stored, false when the save failed; never rejects.
 */
export type SaveRun = (to?: SaveTo) => Promise<boolean>;

/**
 * The shell's autosave bookkeeping: at most one save waiting out the
 * debounce, plus the saves already sent. The shell creates one per mount and
 * its effects and callbacks share it.
 */
export interface PendingSaves {
  /** Forget the waiting save without running it. */
  cancel: () => void;
  /**
   * Start the waiting save now, then wait for every save in flight. Resolves
   * whether the latest save stored its document (true when nothing ran).
   */
  flush: (to?: SaveTo) => Promise<boolean>;
  /**
   * After `run` failed, keep it waiting (with no timer) so the next flush,
   * locale switch or unmount retries it. Only when it is still the latest
   * save and nothing newer waits: an older document must never be sent
   * after a newer one.
   */
  retry: (run: SaveRun) => void;
  /** Make `run` the waiting save, started after `delayMs`. */
  schedule: (run: SaveRun, delayMs: number) => void;
  /** Start the waiting save now, if there is one. */
  start: (to?: SaveTo) => void;
}

export function createPendingSaves(): PendingSaves {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let waiting: SaveRun | null = null;
  let latest: { run: SaveRun; stored: Promise<boolean> } | null = null;
  const inFlight = new Set<Promise<boolean>>();

  function start(to?: SaveTo) {
    clearTimeout(timer);
    const run = waiting;
    if (!run) {
      return;
    }
    waiting = null;
    const stored = run(to);
    latest = { run, stored };
    inFlight.add(stored);
    stored.then(() => inFlight.delete(stored));
  }

  return {
    cancel() {
      clearTimeout(timer);
      waiting = null;
    },
    async flush(to) {
      start(to);
      await Promise.all([...inFlight]);
      return latest ? await latest.stored : true;
    },
    retry(run) {
      if (waiting === null && latest?.run === run) {
        waiting = run;
      }
    },
    schedule(run, delayMs) {
      clearTimeout(timer);
      waiting = run;
      timer = setTimeout(() => start(), delayMs);
    },
    start,
  };
}
