import type { MemberPassResponse } from "@repo/shared/member-pass/types";
import { describe, expect, it } from "vitest";
import { needsRetry, nextPassState } from "./pass-refresh";

const ACTIVE: MemberPassResponse = {
  codes: [
    { code: "v1.u.100.s", slot: 100 },
    { code: "v1.u.101.s", slot: 101 },
  ],
  dayColor: { hex: "#E5484D", name: "red" },
  holder: {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "M",
    startDate: "2026-07-01",
    term: null,
  },
  serverNow: 0,
  state: "active",
  wallets: { apple: false, google: false },
};
const NOT_MEMBER: MemberPassResponse = { state: "not_member" };

describe("nextPassState", () => {
  it("replaces the pass with any 200 body", () => {
    expect(
      nextPassState(ACTIVE, { body: NOT_MEMBER, kind: "body" }, 100)
    ).toEqual({ data: NOT_MEMBER, offline: false });
  });

  it("replaces the pass when the member is signed out", () => {
    expect(nextPassState(ACTIVE, { kind: "unauthenticated" }, 100)).toEqual({
      data: { state: "unavailable" },
      offline: false,
    });
  });

  it("keeps an active pass with usable codes on a server error", () => {
    expect(nextPassState(ACTIVE, { kind: "server_error" }, 101)).toEqual({
      data: ACTIVE,
      offline: true,
    });
  });

  it("keeps an active pass with usable codes when offline", () => {
    expect(nextPassState(ACTIVE, { kind: "network_error" }, 100)).toEqual({
      data: ACTIVE,
      offline: true,
    });
  });

  it("shows unavailable on a server error once no code is left", () => {
    expect(nextPassState(ACTIVE, { kind: "server_error" }, 102)).toEqual({
      data: { state: "unavailable" },
      offline: false,
    });
    expect(nextPassState(null, { kind: "server_error" }, 100)).toEqual({
      data: { state: "unavailable" },
      offline: false,
    });
  });

  it("marks the pass offline when the network fails", () => {
    expect(nextPassState(ACTIVE, { kind: "network_error" }, 102)).toEqual({
      data: ACTIVE,
      offline: true,
    });
    expect(nextPassState(null, { kind: "network_error" }, 100)).toEqual({
      data: null,
      offline: true,
    });
  });
});

describe("needsRetry", () => {
  it("keeps retrying while an active pass is running low on codes", () => {
    // ACTIVE holds slots 100-101: two codes left at 100, none at 102.
    expect(needsRetry(ACTIVE, false, 100)).toBe(true);
    expect(needsRetry(ACTIVE, false, 102)).toBe(true);
  });

  it("keeps retrying while offline, whatever is shown", () => {
    expect(needsRetry(null, true, 100)).toBe(true);
    expect(needsRetry(NOT_MEMBER, true, 100)).toBe(true);
  });

  it("stops once a definitive non-active state is shown", () => {
    expect(needsRetry(NOT_MEMBER, false, 100)).toBe(false);
    expect(needsRetry(null, false, 100)).toBe(false);
  });

  it("does not retry an active pass with plenty of codes", () => {
    const plenty: MemberPassResponse = {
      ...ACTIVE,
      codes: Array.from({ length: 20 }, (_, i) => ({
        code: `v1.u.${100 + i}.s`,
        slot: 100 + i,
      })),
    };
    expect(needsRetry(plenty, false, 100)).toBe(false);
  });
});
