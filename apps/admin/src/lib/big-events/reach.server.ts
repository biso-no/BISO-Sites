import "server-only";

import { createAdminClient } from "@repo/api/server";
import {
  pushTargetUsers,
  type UsersApi,
} from "@repo/shared/big-events/messages/push-targets";
import { unstable_cache } from "next/cache";

export const BIG_EVENT_REACH_TAG = "big-event-reach";

const REACH_REVALIDATE_SECONDS = 300;

type Targets = Awaited<ReturnType<UsersApi["get"]>>;

/** Only the provider types are kept (and cached), nothing else about the account. */
async function fetchTargets(userId: string): Promise<Targets> {
  const { users } = await createAdminClient();
  const user = await users.get({ userId });
  return {
    targets: user.targets.map(({ providerType }) => ({ providerType })),
  };
}

/** Cached per account; a failed lookup throws, so it is never cached. */
const cachedUsers: UsersApi = {
  get: ({ userId }) =>
    unstable_cache(() => fetchTargets(userId), [BIG_EVENT_REACH_TAG, userId], {
      revalidate: REACH_REVALIDATE_SECONDS,
      tags: [BIG_EVENT_REACH_TAG],
    })(),
};

/** The accounts among `userIds` that can get a push. A failed lookup counts as no push. */
export function getPushReach(userIds: string[]): Promise<Set<string>> {
  return pushTargetUsers(cachedUsers, userIds);
}
