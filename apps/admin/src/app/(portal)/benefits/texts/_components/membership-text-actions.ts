import {
  type MembershipSpotData,
  type MembershipSpotInputItem,
  resetMembershipSpot,
  saveMembershipSpot,
} from "../../../_actions/membership-texts";

type Result = { data: true } | { error: string };
type ResetResult = { data: MembershipSpotData } | { error: string };

/**
 * The editor's server actions behind a module of its own. Component tests
 * stub this file; stubbing `_actions/membership-texts` itself would replace
 * it for every other suite in the run, since `mock.module` is process-wide.
 */
export function saveSpot(
  spot: Parameters<typeof saveMembershipSpot>[0],
  items: MembershipSpotInputItem[]
): Promise<Result> {
  return saveMembershipSpot(spot, items);
}

export function resetSpot(
  spot: Parameters<typeof resetMembershipSpot>[0]
): Promise<ResetResult> {
  return resetMembershipSpot(spot);
}
