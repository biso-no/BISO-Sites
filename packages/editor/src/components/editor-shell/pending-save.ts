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
 * Where the saves stand, for the status line and the close-tab prompt: a
 * failed save waits for a retry, a save waits out the debounce or is on its
 * way, or everything is stored.
 */
export type SavesState = "error" | "pending" | "saved";

/**
 * The shell's autosave bookkeeping, per language: at most one save waiting
 * out the debounce (or waiting for a retry after it failed), plus the saves
 * already sent. Each language is its own: a save in one never stands in for
 * the other's. The shell creates one per mount; `onSettled` runs after each
 * save settles, once this bookkeeping is up to date.
 */
export interface PendingSaves {
  /** Forget the save waiting for `locale`, without running it. */
  cancel: (locale: EditorLocale) => void;
  /**
   * Start every waiting save now, retries included, then wait for every save
   * in flight. Resolves whether all of them stored their document.
   */
  flush: (to?: SaveTo) => Promise<boolean>;
  /** Make `run` the save waiting for `locale`, started after `delayMs`. */
  schedule: (locale: EditorLocale, run: SaveRun, delayMs: number) => void;
  /** Start every waiting save now, if there are any. */
  start: (to?: SaveTo) => void;
  state: () => SavesState;
}

interface Waiting {
  /** A save that failed, kept for a retry (no timer). */
  failed: boolean;
  run: SaveRun;
  timer?: ReturnType<typeof setTimeout>;
}

export function createPendingSaves(onSettled: () => void): PendingSaves {
  const waiting = new Map<EditorLocale, Waiting>();
  const latest = new Map<EditorLocale, SaveRun>();
  const inFlight = new Set<Promise<boolean>>();

  function startOne(locale: EditorLocale, to?: SaveTo) {
    const entry = waiting.get(locale);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    waiting.delete(locale);
    const { run } = entry;
    latest.set(locale, run);
    const stored: Promise<boolean> = run(to).then((ok) => {
      inFlight.delete(stored);
      // Kept for a retry by the next flush, locale switch or unmount, but
      // only while it is still its language's latest save and nothing newer
      // waits: an older document must never be sent after a newer one.
      if (!(ok || waiting.has(locale)) && latest.get(locale) === run) {
        waiting.set(locale, { failed: true, run });
      }
      onSettled();
      return ok;
    });
    inFlight.add(stored);
  }

  function start(to?: SaveTo) {
    for (const locale of [...waiting.keys()]) {
      startOne(locale, to);
    }
  }

  return {
    cancel(locale) {
      clearTimeout(waiting.get(locale)?.timer);
      waiting.delete(locale);
    },
    async flush(to) {
      start(to);
      await Promise.all([...inFlight]);
      return ![...waiting.values()].some((entry) => entry.failed);
    },
    schedule(locale, run, delayMs) {
      clearTimeout(waiting.get(locale)?.timer);
      waiting.set(locale, {
        failed: false,
        run,
        timer: setTimeout(() => startOne(locale), delayMs),
      });
    },
    start,
    state() {
      const entries = [...waiting.values()];
      if (entries.some((entry) => entry.failed)) {
        return "error";
      }
      return entries.length > 0 || inFlight.size > 0 ? "pending" : "saved";
    },
  };
}
