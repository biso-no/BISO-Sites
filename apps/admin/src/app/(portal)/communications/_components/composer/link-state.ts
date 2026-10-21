import type { PrefillSnapshot } from "./composer-state";

/** What the linked card shows for the content the announcement points at. */
export interface LinkedDisplay {
  id: string;
  image: string | null;
  /** "{dateLabel} · {campus}", empty when only the title is known. */
  meta: string;
  title: string;
}

export interface LinkState {
  display: LinkedDisplay | null;
  /** What the last prefill wrote, so re-linking only replaces untouched text. */
  snapshot: PrefillSnapshot | null;
  /** The one-line note shown after linking. */
  tip: string | null;
}

export function buildLinkState(): LinkState {
  return { display: null, snapshot: null, tip: null };
}
