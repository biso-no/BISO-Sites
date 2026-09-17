import "server-only";
import { getMembershipStatus } from "@/lib/actions/membership";
import { getLoggedInUser } from "@/lib/actions/user";
import { buildHolder, memberPassStateFor } from "./state";
import type { MemberPassHolder, MemberPassState } from "./types";

export type ResolvedMemberPass =
  | { state: "unauthenticated" }
  | { state: Exclude<MemberPassState, "active"> }
  | { holder: MemberPassHolder; state: "active"; userId: string };

/** The signed-in user's pass, gated on a live membership check. */
export async function resolveMemberPass(): Promise<ResolvedMemberPass> {
  const userData = await getLoggedInUser();
  if (!userData) {
    return { state: "unauthenticated" };
  }
  const status = await getMembershipStatus();
  const state = memberPassStateFor(status);
  if (state !== "active") {
    return { state };
  }
  const name =
    userData.profile?.name?.trim() || userData.user.name?.trim() || "";
  const holder = buildHolder(name, status);
  if (!holder) {
    return { state: "unavailable" };
  }
  return { holder, state: "active", userId: userData.user.$id };
}
