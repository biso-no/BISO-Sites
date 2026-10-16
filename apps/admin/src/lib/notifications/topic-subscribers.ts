import "server-only";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { topicIdFor } from "@repo/shared/utils/notification-topics";
import { unstable_cache } from "next/cache";

/** How long a subscriber count may be stale. Counts move slowly. */
const COUNT_TTL_SECONDS = 300;

/**
 * Read the total off a subscriber list, or `null` if it is not a number.
 *
 * Deliberately never coerces a missing total to `0`. This helper exists to
 * replace a hardcoded, fabricated follower count, and reporting a confident
 * "0 students" when the lookup failed would be the same class of lie.
 */
export function pickPushSubscriberTotal(
  list: { subscribers?: unknown[]; total?: unknown } | undefined
): number | null {
  const total = list?.total;
  return typeof total === "number" ? total : null;
}

/**
 * How many push targets are subscribed to `topicId`.
 *
 * Filtered to `providerType: "push"` because this number is shown next to a
 * push toggle — email targets on the same topic would inflate it. Returns
 * `null` when the count cannot be determined, so callers can say so rather
 * than show a number they cannot stand behind.
 */
export async function getTopicSubscriberCount(
  topicId: string
): Promise<number | null> {
  try {
    const { messaging } = await createAdminClient();
    const list = await messaging.listSubscribers({
      topicId,
      queries: [Query.equal("providerType", "push"), Query.limit(1)],
    });
    return pickPushSubscriberTotal(list);
  } catch (error) {
    console.error(`[topic-subscribers] count failed for ${topicId}:`, error);
    return null;
  }
}

/**
 * Push subscriber counts for the events topic of each campus, keyed by campus
 * id. Fetched in parallel and cached briefly.
 */
export const getEventTopicSubscriberCounts = unstable_cache(
  async (campusIds: string[]): Promise<Record<string, number | null>> => {
    const entries = await Promise.all(
      campusIds.map(
        async (campusId) =>
          [
            campusId,
            await getTopicSubscriberCount(topicIdFor("events", campusId)),
          ] as const
      )
    );
    return Object.fromEntries(entries);
  },
  ["event-topic-subscriber-counts"],
  { revalidate: COUNT_TTL_SECONDS }
);
