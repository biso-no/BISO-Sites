/**
 * The background check's one-line reason per receipt, for whoever reads the
 * expense after the check: the approval card, the approval email and (later)
 * the admin. Pure, so every surface applies the same rule.
 *
 * Per receipt: the note of the check's latest change (a type, an account or a
 * project), without its "Confidence x: " prefix. Failing that, the note of its
 * latest flag, but only when no hint tied to the receipt is shown already.
 * A receipt the check neither changed nor flagged has no note. Only the
 * check's own events count (`CHECK_ACTOR_NAME`): the submit and the fixed
 * steps write AI events too, and their reasons are not the check's.
 */

import type { ApproverHint } from "./expense-hints";

export interface CheckNoteEvent {
  $createdAt?: string;
  action: string;
  actor_kind: string;
  actor_name?: string | null;
  attachment_id?: string | null;
  field?: string | null;
  note?: string | null;
}

/** How the background check signs its history events (`expense_events.actor_name`). */
export const CHECK_ACTOR_NAME = "AI check";
const CHECK_ACTOR_KIND = "ai";
const CONFIDENCE_PREFIX = /^Confidence [\d.]+:\s*/;

/** An event the background check itself wrote. */
function isCheckEvent(event: CheckNoteEvent): boolean {
  return (
    event.actor_kind === CHECK_ACTOR_KIND &&
    event.actor_name === CHECK_ACTOR_NAME
  );
}

function isCheckChange(event: CheckNoteEvent): boolean {
  return (
    isCheckEvent(event) &&
    (event.action === "ai_classified" ||
      event.action === "ai_account_chosen" ||
      (event.action === "edited" && event.field === "project"))
  );
}

function noteText(event: CheckNoteEvent): string {
  return (event.note ?? "").replace(CONFIDENCE_PREFIX, "").trim();
}

/** Newest first; events without a time keep the later one first. */
function newestFirst(events: CheckNoteEvent[]): CheckNoteEvent[] {
  return events
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        (b.event.$createdAt ?? "").localeCompare(a.event.$createdAt ?? "") ||
        b.index - a.index
    )
    .map(({ event }) => event);
}

/** The first non-empty note among the receipt's events of the check, newest first. */
function firstNote(
  events: CheckNoteEvent[],
  pick: (event: CheckNoteEvent) => boolean
): string | undefined {
  for (const event of events) {
    const note = pick(event) ? noteText(event) : "";
    if (note) {
      return note;
    }
  }
}

export function pickCheckNotes({
  events,
  hints,
}: {
  events: CheckNoteEvent[];
  hints: ApproverHint[];
}): Map<string, string> {
  const hinted = new Set(
    hints.flatMap((hint) => (hint.attachmentId ? [hint.attachmentId] : []))
  );
  const byReceipt = new Map<string, CheckNoteEvent[]>();
  for (const event of newestFirst(events)) {
    if (!(isCheckEvent(event) && event.attachment_id)) {
      continue;
    }
    byReceipt.set(event.attachment_id, [
      ...(byReceipt.get(event.attachment_id) ?? []),
      event,
    ]);
  }

  const notes = new Map<string, string>();
  for (const [receiptId, own] of byReceipt) {
    const note =
      firstNote(own, isCheckChange) ??
      (hinted.has(receiptId)
        ? undefined
        : firstNote(own, (event) => event.action === "ai_flagged"));
    if (note) {
      notes.set(receiptId, note);
    }
  }
  return notes;
}
