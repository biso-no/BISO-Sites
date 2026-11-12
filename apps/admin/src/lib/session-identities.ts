import { createSessionClient } from "@repo/api/server";
import { cache } from "react";
import type { Identity } from "./microsoft-identity";

/**
 * The signed-in account's identities, read once per request. Null when they
 * cannot be read: callers fail closed and the failure is logged.
 */
export const getSessionIdentities = cache(
  async (): Promise<Identity[] | null> => {
    try {
      const { account } = await createSessionClient();
      const { identities } = await account.listIdentities();
      return identities;
    } catch (error) {
      console.error("[expense-access] identity lookup failed", error);
      return null;
    }
  }
);
