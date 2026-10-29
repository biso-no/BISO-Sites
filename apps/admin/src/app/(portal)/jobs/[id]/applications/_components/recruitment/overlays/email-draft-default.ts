/**
 * Whether the advance-stage modal drafts a candidate email as soon as it
 * opens. It never does: a draft is a model call about a candidate, so it
 * starts only when HR clicks "Draft email with AI". That also keeps an offer
 * mail from appearing before HR has approved the offer; nothing in the system
 * sends candidate email, and the draft is copied into Outlook by hand.
 */
export function draftsEmailByDefault(_targetStatus: string | null): boolean {
  return false;
}

/** Helper text beside the draft button; the offer wording says what it is for. */
export function draftEmailLabel(targetStatus: string | null): string {
  return targetStatus === "accepted"
    ? "Draft the offer email (only once HR has approved the offer)"
    : "Draft a candidate notification email";
}
