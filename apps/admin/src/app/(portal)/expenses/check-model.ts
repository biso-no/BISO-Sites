import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import type { ExpenseDetailEvent } from "./expenses-data";

/** The background check is still working while it is queued or running. */
export function isChecking(state: string | null | undefined): boolean {
  return state === "queued" || state === "running";
}

/** The classification note reads "Confidence 0.8: reason"; only the reason is shown. */
const CONFIDENCE_PREFIX = /^Confidence [\d.,]+: /;

/** Events that carry the check's own reason for a change it made. */
function isChangeEvent(event: ExpenseDetailEvent): boolean {
  return (
    event.action === "ai_classified" ||
    event.action === "ai_account_chosen" ||
    (event.action === "edited" && event.field === "project")
  );
}

/**
 * The check's one-line reason for a receipt: the note of its latest change
 * event. A flag's note is used only when no hint for the receipt is shown, as
 * the hint says the same. Events come oldest first, as the detail loads them.
 */
export function checkReasonFor(
  events: readonly ExpenseDetailEvent[],
  attachmentId: string,
  hintShown: boolean
): string | null {
  const notes = events.filter(
    (event) =>
      event.actorKind === "ai" &&
      event.attachmentId === attachmentId &&
      event.note?.trim()
  );
  const latestFirst = [...notes].reverse();
  const wanted =
    latestFirst.find(isChangeEvent) ?? (hintShown ? undefined : latestFirst[0]);
  const note = wanted?.note?.trim();
  return note ? note.replace(CONFIDENCE_PREFIX, "") : null;
}

export function hintsForReceipt(
  hints: readonly ApproverHint[],
  attachmentId: string
): ApproverHint[] {
  return hints.filter((hint) => hint.attachmentId === attachmentId);
}
