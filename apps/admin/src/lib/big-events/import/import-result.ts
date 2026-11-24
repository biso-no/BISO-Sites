/** What saving an import did, in counts. */
export interface ImportResult {
  /** Every write succeeded. When false, the organizer checks the list before importing again. */
  complete: boolean;
  created: number;
  /** Writes that failed. */
  failed: number;
  /** Connected to their BI account by ticket email. */
  linked: number;
  moved: number;
  newGroups: number;
  outsideYourCampus: number;
  placed: number;
  skipped: number;
  /** Got a "possible match" to confirm. */
  suggested: number;
  unchanged: number;
  updated: number;
  /** Writes that succeeded; 0 means nothing was changed. */
  written: number;
}

export type SaveOutcome = "saved" | "nothing_changed" | "partly_saved";

/**
 * What the wizard tells the organizer after Save. A call that failed on the
 * way back may have written anything, so it counts as partly saved.
 */
export function saveOutcome(result: ImportResult | null): SaveOutcome {
  if (result?.complete) {
    return "saved";
  }
  if (result && result.written === 0) {
    return "nothing_changed";
  }
  return "partly_saved";
}
