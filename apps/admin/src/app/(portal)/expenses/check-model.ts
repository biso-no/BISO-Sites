import { pickCheckNotes } from "@repo/shared/utils/expense-check-notes";
import type { ApproverHint } from "@repo/shared/utils/expense-hints";
import type { ExpenseDetailEvent } from "./expenses-data";

/** The background check is still working while it is queued or running. */
export function isChecking(state: string | null | undefined): boolean {
  return state === "queued" || state === "running";
}

/**
 * The check's one-line reason for a receipt. A thin adapter over the shared
 * `pickCheckNotes`, so the admin, the approval card and the email apply one
 * rule. `hintShown` says a hint for the receipt is on screen: the flag's note
 * is then left out, as the hint says the same. Events come oldest first, as
 * the detail loads them.
 */
export function checkReasonFor(
  events: readonly ExpenseDetailEvent[],
  attachmentId: string,
  hintShown: boolean
): string | null {
  const hints: ApproverHint[] = hintShown
    ? [{ attachmentId, code: "type_unsure" }]
    : [];
  const notes = pickCheckNotes({
    events: events.map((event) => ({
      $createdAt: event.at,
      action: event.action,
      actor_kind: event.actorKind,
      actor_name: event.actorName,
      attachment_id: event.attachmentId,
      field: event.field,
      note: event.note,
    })),
    hints,
  });
  return notes.get(attachmentId) ?? null;
}

export function hintsForReceipt(
  hints: readonly ApproverHint[],
  attachmentId: string
): ApproverHint[] {
  return hints.filter((hint) => hint.attachmentId === attachmentId);
}
