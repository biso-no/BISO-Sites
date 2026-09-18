import type { MemberPassCode } from "@repo/shared/utils/member-pass-slots";
import type { MembershipTerm } from "@repo/shared/utils/membership-plans";

/**
 * Wire types for `GET /api/member-pass`. Client-safe: type-only imports.
 */

export type MemberPassState =
  | "active"
  | "no_bi_identity"
  | "not_member"
  | "expired"
  | "unavailable";

export interface MemberPassHolder {
  expiryDate: string;
  membershipName: string;
  name: string;
  startDate: string;
  term: MembershipTerm | null;
}

export interface MemberPassDayColor {
  hex: string;
  name: string;
}

export interface MemberPassWallets {
  apple: boolean;
  google: boolean;
}

export type MemberPassResponse =
  | {
      codes: MemberPassCode[];
      dayColor: MemberPassDayColor;
      holder: MemberPassHolder;
      serverNow: number;
      state: "active";
      wallets: MemberPassWallets;
    }
  | { state: Exclude<MemberPassState, "active"> };
