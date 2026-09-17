import {
  signAppleWalletCode,
  signWebPassCode,
} from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import { MembershipComputationError } from "@repo/shared/utils/membership-status";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Injected rather than `vi.mock("./scan-store")`: mocking the sibling module
// is unnecessary since verifyScan takes its dependencies through `deps`.
import { verifyScan } from "./verify-scan";

const findLatestCountedScan = vi.fn();
const recordScan = vi.fn();
const scans = { latestSince: findLatestCountedScan, record: recordScan };

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const NOW = new Date("2026-09-17T10:00:00Z");
const USER = "member-1";
const STAFF = { kind: "staff", userId: "staff-1" } as const;
const getRow = vi.fn();
const db = { getRow } as any;
const getStatus = vi.fn();
const deps = { db, getStatus, now: NOW, scans, secret: SECRET };
const code = () => signWebPassCode(USER, passSlot(NOW.getTime()), SECRET);

const ACTIVE = {
  checkedAt: 0,
  finagoCategoryIds: [113_176],
  isMember: true,
  memberships: [
    {
      category: "113176",
      expiryDate: "2026-12-31",
      id: "54",
      name: "Semester",
      startDate: "2026-07-01",
    },
  ],
};

describe("verifyScan", () => {
  // The error paths below log via console.error by design; a spy keeps that
  // expected noise out of the test output.
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const fn of [findLatestCountedScan, recordScan, getRow, getStatus]) {
      fn.mockReset();
    }
    getRow.mockResolvedValue({
      $id: USER,
      name: "Markus Heien",
      student_id: "s1715738",
    });
    getStatus.mockResolvedValue(ACTIVE);
    findLatestCountedScan.mockResolvedValue(null);
    recordScan.mockResolvedValue(undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // silence expected error-path logging
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("lets a live member through", async () => {
    const outcome = await verifyScan(code(), STAFF, deps);
    expect(outcome).toEqual({
      expiryDate: "2026-12-31",
      membershipName: "Semester",
      name: "Markus Heien",
      result: "valid",
    });
    expect(getStatus).toHaveBeenCalledWith(1_715_738);
    expect(recordScan.mock.calls[0]?.[0]).toMatchObject({
      codeKind: "web",
      memberUserId: USER,
      result: "valid",
      scanner: STAFF,
    });
    expect(JSON.stringify(outcome)).not.toContain("1715738");
  });

  it("denies a forged code without touching Finago or the log", async () => {
    const outcome = await verifyScan(
      "v1.member-1.1.AAAAAAAAAAAAAAAAAAAAAA",
      STAFF,
      deps
    );
    expect(outcome).toEqual({ reason: "bad_code", result: "denied" });
    expect(getStatus).not.toHaveBeenCalled();
    expect(recordScan).not.toHaveBeenCalled();
  });

  it("denies a stale code", async () => {
    const old = signWebPassCode(USER, passSlot(NOW.getTime()) - 5, SECRET);
    expect(await verifyScan(old, STAFF, deps)).toEqual({
      reason: "stale",
      result: "denied",
    });
  });

  it("denies an account with no linked student", async () => {
    getRow.mockResolvedValue({ $id: USER, name: "X", student_id: null });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      reason: "not_linked",
      result: "denied",
    });
    expect(recordScan.mock.calls[0]?.[0]).toMatchObject({
      reason: "not_linked",
      result: "denied",
    });
  });

  it("reports unavailable when the profile lookup fails for a reason other than 404", async () => {
    getRow.mockRejectedValue(new Error("down"));
    expect(await verifyScan(code(), STAFF, deps)).toEqual({
      result: "unavailable",
    });
    expect(getStatus).not.toHaveBeenCalled();
    expect(recordScan.mock.calls[0]?.[0]).toMatchObject({
      result: "unavailable",
    });
  });

  it("treats a 404 profile lookup as an unlinked account, not unavailable", async () => {
    getRow.mockRejectedValue({ code: 404 });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      reason: "not_linked",
      result: "denied",
    });
    expect(getStatus).not.toHaveBeenCalled();
  });

  it("denies a lapsed member with the right reason", async () => {
    getStatus.mockResolvedValue({
      ...ACTIVE,
      isMember: false,
      memberships: [],
      reason: "expired",
    });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      reason: "expired",
      result: "denied",
      name: "Markus Heien",
    });
    getStatus.mockResolvedValue({
      ...ACTIVE,
      isMember: false,
      memberships: [],
      reason: "no_categories",
    });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      reason: "not_member",
      result: "denied",
    });
  });

  it("reports unavailable when Finago fails", async () => {
    getStatus.mockRejectedValue(new MembershipComputationError("finago_error"));
    expect(await verifyScan(code(), STAFF, deps)).toEqual({
      result: "unavailable",
    });
  });

  it("flags a second scan within ten minutes", async () => {
    findLatestCountedScan.mockResolvedValue({
      $createdAt: new Date(NOW.getTime() - 40_000).toISOString(),
    });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      result: "duplicate",
      secondsSincePrevious: 40,
    });
    const [, since] = findLatestCountedScan.mock.calls[0] ?? [];
    expect(since).toEqual(new Date(NOW.getTime() - 10 * 60 * 1000));
  });

  it("never reports a negative time since a slightly future scan", async () => {
    findLatestCountedScan.mockResolvedValue({
      $createdAt: new Date(NOW.getTime() + 2000).toISOString(),
    });
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      result: "duplicate",
      secondsSincePrevious: 0,
    });
  });

  it("asks for ID on an Apple Wallet code, but duplicate wins", async () => {
    const apple = signAppleWalletCode(USER, "2026-12-31", SECRET);
    expect(await verifyScan(apple, STAFF, deps)).toMatchObject({
      result: "check_id",
    });
    findLatestCountedScan.mockResolvedValue({
      $createdAt: new Date(NOW.getTime() - 5000).toISOString(),
    });
    expect(await verifyScan(apple, STAFF, deps)).toMatchObject({
      result: "duplicate",
    });
  });

  it("still answers when the scan log cannot be written", async () => {
    recordScan.mockRejectedValue(new Error("down"));
    expect(await verifyScan(code(), STAFF, deps)).toMatchObject({
      result: "valid",
    });
  });

  it("reports unavailable when the duplicate check cannot run", async () => {
    // Failing open here would let one pass through the door repeatedly.
    findLatestCountedScan.mockRejectedValue(new Error("down"));
    expect(await verifyScan(code(), STAFF, deps)).toEqual({
      result: "unavailable",
    });
    expect(recordScan.mock.calls.at(-1)?.[0]).toMatchObject({
      result: "unavailable",
    });
  });
});
