"use server";
import { createSessionClient } from "@repo/api/server";
import {
  type EventRsvpStatus,
  type EventRsvpSummary,
  parseEventRsvpStatus,
  setEventRsvp,
} from "@repo/shared/utils/event-rsvp";
import { getLiveMembershipStatus } from "@/lib/actions/membership";
import { isAuthenticatedAccount } from "@/lib/auth-utils";
import { createEventRsvpDb } from "@/lib/event-rsvp";

export type RespondToEventError =
  | "closed"
  | "invalid_request"
  | "members_only"
  | "not_authenticated"
  | "not_found"
  | "unavailable";

export async function respondToEvent(
  eventId: string,
  status: EventRsvpStatus | null
): Promise<{
  success: boolean;
  data?: EventRsvpSummary;
  error?: RespondToEventError;
}> {
  const parsed = parseEventRsvpStatus(status);
  if (parsed === undefined || typeof eventId !== "string" || !eventId) {
    return { success: false, error: "invalid_request" };
  }

  let userId: string;
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    if (!isAuthenticatedAccount(user)) {
      return { success: false, error: "not_authenticated" };
    }
    userId = user.$id;
  } catch {
    return { success: false, error: "not_authenticated" };
  }

  try {
    const result = await setEventRsvp(await createEventRsvpDb(), {
      eventId,
      isMember: async () => (await getLiveMembershipStatus()).isMember,
      now: new Date(),
      status: parsed,
      userId,
    });
    return result.ok
      ? { success: true, data: result.summary }
      : { success: false, error: result.reason };
  } catch (error) {
    console.error("Error saving event RSVP:", error);
    return { success: false, error: "unavailable" };
  }
}
