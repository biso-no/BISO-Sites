"use client";

import { identifyUser } from "@repo/shared/utils/analytics";
import { useEffect } from "react";

/**
 * Non-PII identity attached to the Umami session for logged-in members. The id
 * is the Appwrite account `$id` (never name/email) — names are resolved
 * admin-side from the id. Only authenticated users reach here, since the layout
 * derives this from `getLoggedInUser()` which returns null for anonymous sessions.
 */
export interface MemberIdentity {
  accountId: string;
  campus?: string;
  isMember?: boolean;
  role?: string;
}

export function AnalyticsIdentity({
  identity,
}: {
  identity: MemberIdentity | null;
}) {
  const accountId = identity?.accountId;
  const campus = identity?.campus;
  const role = identity?.role;
  const isMember = identity?.isMember;

  useEffect(() => {
    if (!accountId) {
      return;
    }
    identifyUser(accountId, { campus, role, isMember });
  }, [accountId, campus, role, isMember]);

  return null;
}
