/**
 * A booking link works only while the candidate is in the interview stage and
 * the vacancy has not been closed. There is no deadline check: interviews are
 * booked after the application deadline.
 */
export function isBookingLinkUsable(state: {
  applicationStatus: string | null | undefined;
  jobStatus: string | null | undefined;
}): boolean {
  return (
    state.applicationStatus === "interview" && state.jobStatus !== "closed"
  );
}

/** What the candidate is told when the link no longer works. */
export const BOOKING_LINK_UNAVAILABLE_MESSAGE =
  "This booking link has expired.";
