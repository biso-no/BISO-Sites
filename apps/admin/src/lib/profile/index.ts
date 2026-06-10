"use server";

import {
  type MembershipCheckResult,
  checkMembership as sharedCheckMembership,
} from "@repo/shared/utils/membership";

export type { MembershipCheckResult };

/** Server-action wrapper around the shared membership verification helper. */
export async function checkMembership(): Promise<MembershipCheckResult> {
  return await sharedCheckMembership();
}
