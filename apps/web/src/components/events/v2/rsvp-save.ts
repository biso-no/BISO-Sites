import type {
  EventRsvpStatus,
  EventRsvpSummary,
} from "@repo/shared/utils/event-rsvp";

type Save = (
  eventId: string,
  status: EventRsvpStatus | null
) => Promise<{ success: boolean; data?: EventRsvpSummary }>;

/**
 * Saves an answer and settles the state. A rejected call (network failure, a
 * stale action after a deploy) is a failed save like any other: the previous
 * summary comes back and the failure flag is set.
 */
export async function settleRsvpSave(
  save: Save,
  eventId: string,
  next: EventRsvpStatus | null,
  previous: EventRsvpSummary
): Promise<{ failed: boolean; summary: EventRsvpSummary }> {
  try {
    const result = await save(eventId, next);
    if (result.success && result.data) {
      return { failed: false, summary: result.data };
    }
  } catch {
    // Treated as a failed save below.
  }
  return { failed: true, summary: previous };
}
