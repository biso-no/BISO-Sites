import { describeMembershipTerm } from "@repo/shared/utils/membership-plans";
import {
  type MembershipStatus,
  pickCurrentMembership,
} from "@repo/shared/utils/membership-status";
import type { MemberPassHolder, MemberPassState } from "./types";

const NOT_LINKED_REASONS = new Set(["no_student_id", "invalid_student_id"]);
const TRANSIENT_REASONS = new Set(["finago_error", "unexpected_error"]);

export function memberPassStateFor(status: MembershipStatus): MemberPassState {
  if (status.isMember) {
    return "active";
  }
  const reason = status.reason ?? "";
  if (NOT_LINKED_REASONS.has(reason)) {
    return "no_bi_identity";
  }
  if (TRANSIENT_REASONS.has(reason)) {
    return "unavailable";
  }
  if (reason === "expired") {
    return "expired";
  }
  return "not_member";
}

export function buildHolder(
  name: string,
  status: MembershipStatus
): MemberPassHolder | null {
  const current = pickCurrentMembership(status.memberships);
  if (!current) {
    return null;
  }
  return {
    expiryDate: current.expiryDate,
    membershipName: current.name,
    name,
    startDate: current.startDate,
    term: describeMembershipTerm(current.startDate, current.expiryDate),
  };
}
