/**
 * A booking link works while the candidate is in the interview stage and the
 * vacancy still exists. A closed vacancy does not matter: HR closes a vacancy
 * after its deadline, which is when interviews get booked.
 */
export function isBookingLinkUsable(state: {
  applicationStatus: string | null | undefined;
  hasJob: boolean;
}): boolean {
  return state.applicationStatus === "interview" && state.hasJob;
}

/** What the candidate is told when the link no longer works. */
export const BOOKING_LINK_UNAVAILABLE_MESSAGE =
  "This booking link has expired.";
