import "server-only";

/**
 * Which linked accounts can get a push: an account with a push target
 * (the app registered a device). One lookup per account, at most eight in
 * flight; a failed lookup counts as no push.
 */

import { mapWithConcurrency } from "../../utils/concurrency";

const LOOKUP_CONCURRENCY = 8;

/** Minimal slice of Appwrite `Users`, satisfied by `createAdminClient().users`. */
export interface UsersApi {
  get(params: {
    userId: string;
  }): Promise<{ targets: { providerType: string }[] }>;
}

/** The accounts among `userIds` that can get a push. */
export async function pushTargetUsers(
  users: UsersApi,
  userIds: string[]
): Promise<Set<string>> {
  const unique = [...new Set(userIds)];
  const results = await mapWithConcurrency(
    unique,
    LOOKUP_CONCURRENCY,
    async (userId) => {
      try {
        const user = await users.get({ userId });
        return user.targets.some((target) => target.providerType === "push");
      } catch {
        return false;
      }
    }
  );
  return new Set(unique.filter((_, index) => results[index]));
}
