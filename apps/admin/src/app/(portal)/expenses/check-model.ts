import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import type { ExpenseDetailEvent } from "./expenses-data";

/** The background check is still working while it is queued or running. */
export function isChecking(state: string | null | undefined): boolean {
  return state === "queued" || state === "running";
}

/** The classification note reads "Confidence 0.8: reason"; only the reason is shown. */
const CONFIDENCE_PREFIX = /^Confidence [\d.,]+: /;

/**
 * The check's one-line reason for a receipt: the note of its latest AI-check
 * event. Events come oldest first, as the detail loads them.
 */
export function checkReasonFor(
  events: readonly ExpenseDetailEvent[],
  attachmentId: string
): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (
      event?.actorKind !== "ai" ||
      event.attachmentId !== attachmentId ||
      !event.note?.trim()
    ) {
      continue;
    }
    return event.note.trim().replace(CONFIDENCE_PREFIX, "");
  }
  return null;
}

export function hintsForReceipt(
  hints: readonly ApproverHint[],
  attachmentId: string
): ApproverHint[] {
  return hints.filter((hint) => hint.attachmentId === attachmentId);
}
