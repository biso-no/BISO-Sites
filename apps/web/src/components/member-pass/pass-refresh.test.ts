import { describe, expect, it } from "vitest";
import type { MemberPassResponse } from "@/lib/member-pass/types";
import { nextPassState } from "./pass-refresh";

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
