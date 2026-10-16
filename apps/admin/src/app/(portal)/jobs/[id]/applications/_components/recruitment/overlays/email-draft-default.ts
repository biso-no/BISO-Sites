/**
 * Whether the advance-stage modal drafts a candidate email as soon as it
 * opens for a given target status.
 *
 * HR reported a "you got the job" mail reaching a candidate without their
 * approval. Nothing in the system sends candidate email; the only offer text
 * that exists is the AI draft this modal produced on open, which someone then
 * pasted into Outlook. So the offer draft is opt-in: moving a candidate to
 * Accepted shows no email until HR asks for one. Every other stage keeps
 * drafting by default, since those mails carry no decision.
 */
export function draftsEmailByDefault(targetStatus: string | null): boolean {
  return targetStatus !== "accepted";
}

/** The checkbox label; the offer wording says what the draft is for. */
export function draftEmailLabel(targetStatus: string | null): string {
  return targetStatus === "accepted"
    ? "Draft the offer email (only once HR has approved the offer)"
    : "Draft a candidate notification email";
}
