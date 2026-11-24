import "server-only";

import { createAdminClient } from "@repo/api/server";
import { mapWithConcurrency } from "@repo/shared/utils/concurrency";
import { unstable_cache } from "next/cache";

export const BIG_EVENT_REACH_TAG = "big-event-reach";

const REACH_CONCURRENCY = 8;
const REACH_REVALIDATE_SECONDS = 300;

async function fetchHasPushTarget(userId: string): Promise<boolean> {
  const { users } = await createAdminClient();
  const user = await users.get({ userId });
  return user.targets.some((target) => target.providerType === "push");
}

/** Cached per account; a failed lookup throws, so it is never cached. */
function hasPushTarget(userId: string): Promise<boolean> {
  return unstable_cache(
    () => fetchHasPushTarget(userId),
    [BIG_EVENT_REACH_TAG, userId],
    { revalidate: REACH_REVALIDATE_SECONDS, tags: [BIG_EVENT_REACH_TAG] }
  )();
}

/** The accounts among `userIds` that can get a push. A failed lookup counts as no push. */
export async function getPushReach(userIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(userIds)];
  const results = await mapWithConcurrency(
    unique,
    REACH_CONCURRENCY,
    async (userId) => {
      try {
        return await hasPushTarget(userId);
      } catch {
        return false;
      }
    }
  );
  return new Set(unique.filter((_, index) => results[index]));
}
