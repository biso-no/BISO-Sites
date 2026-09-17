import { describe, expect, it } from "vitest";
import {
  dayColor,
  googleWalletCodePattern,
  googleWalletTotpKeyHex,
  isRecentDuplicate,
  issueWebPassCodes,
  readMemberPassSecret,
  signAppleWalletCode,
  signWebPassCode,
  totp,
  verifyMemberPassCode,
} from "./member-pass";
import { passSlot } from "./member-pass-slots";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const OTHER_SECRET = "another-secret-that-is-at-least-32-characters";
const USER = "6aa3847618da8122d12c";
const NOW = new Date("2026-09-17T10:00:00Z");
const SLOT = passSlot(NOW.getTime());
const HEX40_RE = /^[0-9a-f]{40}$/;
const HEX_COLOR_RE = /^#[0-9A-F]{6}$/;

describe("readMemberPassSecret", () => {
  it("accepts only a long enough secret", () => {
    expect(readMemberPassSecret({ MEMBER_PASS_SECRET: ` ${SECRET} ` })).toBe(
      SECRET
    );
    expect(readMemberPassSecret({ MEMBER_PASS_SECRET: "short" })).toBeNull();
    expect(readMemberPassSecret({})).toBeNull();
  });
});

describe("web pass codes", () => {
  it("verifies a code for the current slot", () => {
    const code = signWebPassCode(USER, SLOT, SECRET);
    expect(code.startsWith(`v1.${USER}.${SLOT}.`)).toBe(true);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      kind: "web",
      ok: true,
      slot: SLOT,
      userId: USER,
    });
  });

  it("accepts one slot of drift either way and no more", () => {
    for (const offset of [-1, 1]) {
      const code = signWebPassCode(USER, SLOT + offset, SECRET);
      expect(verifyMemberPassCode(code, SECRET, NOW).ok).toBe(true);
    }
    for (const offset of [-2, 2]) {
      const code = signWebPassCode(USER, SLOT + offset, SECRET);
      expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
        ok: false,
        reason: "stale",
      });
    }
  });

  it("rejects a tampered or foreign code", () => {
    const code = signWebPassCode(USER, SLOT, SECRET);
    const swapped = code.replace(USER, "someoneelse0000000000");
    expect(verifyMemberPassCode(swapped, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
    expect(verifyMemberPassCode(code, OTHER_SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("handles user ids containing dots", () => {
    const code = signWebPassCode("a.b.c", SLOT, SECRET);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toMatchObject({
      ok: true,
      userId: "a.b.c",
    });
  });

  it("rejects malformed input", () => {
    for (const input of ["", "hello", "v1.x", "v9.a.1.sig", "https://x.no"]) {
      expect(verifyMemberPassCode(input, SECRET, NOW)).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
  });

  it("issues twenty consecutive codes from the current slot", () => {
    const codes = issueWebPassCodes(USER, NOW.getTime(), SECRET);
    expect(codes).toHaveLength(20);
    expect(codes[0]?.slot).toBe(SLOT);
    expect(codes[19]?.slot).toBe(SLOT + 19);
    expect(codes[0]?.code).toBe(signWebPassCode(USER, SLOT, SECRET));
  });
});

describe("totp", () => {
  // RFC 6238 appendix B, SHA-1, 8 digits.
  const key = Buffer.from("12345678901234567890");
  it.each([
    [59, "94287082"],
    [1_111_111_109, "07081804"],
    [1_234_567_890, "89005924"],
    [2_000_000_000, "69279037"],
  ])("matches the RFC vector at T=%i", (seconds, expected) => {
    expect(totp(key, Math.floor(seconds / 30), 8)).toBe(expected);
  });
});

describe("google wallet codes", () => {
  it("derives a stable 20-byte hex key per user", () => {
    const key = googleWalletTotpKeyHex(USER, SECRET);
    expect(key).toMatch(HEX40_RE);
    expect(googleWalletTotpKeyHex(USER, SECRET)).toBe(key);
    expect(googleWalletTotpKeyHex("other", SECRET)).not.toBe(key);
  });

  it("verifies the value Google Wallet would render", () => {
    const key = Buffer.from(googleWalletTotpKeyHex(USER, SECRET), "hex");
    const value = totp(key, SLOT);
    const code = googleWalletCodePattern(USER).replace("{totp_value_0}", value);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      kind: "google",
      ok: true,
      slot: SLOT,
      userId: USER,
    });
  });

  it("rejects an old TOTP value", () => {
    const key = Buffer.from(googleWalletTotpKeyHex(USER, SECRET), "hex");
    const code = `g1.${USER}.${totp(key, SLOT - 3)}`;
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });
});

describe("apple wallet codes", () => {
  it("verifies until the end of the expiry day in Oslo", () => {
    const code = signAppleWalletCode(USER, "2026-12-31", SECRET);
    expect(code.startsWith(`a1.${USER}.20261231.`)).toBe(true);
    expect(verifyMemberPassCode(code, SECRET, NOW)).toEqual({
      expiry: "2026-12-31",
      kind: "apple",
      ok: true,
      userId: USER,
    });
    expect(
      // 23:30 UTC on Dec 31 is 00:30 CET on Jan 1 in Oslo (UTC+1 in winter),
      // i.e. the day after the expiry date. The brief's original 22:30 UTC
      // is still 23:30 CET on Dec 31 itself (same Oslo day as the expiry
      // date), so it does not exercise "after the expiry day ends".
      verifyMemberPassCode(code, SECRET, new Date("2026-12-31T23:30:00Z"))
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a forged expiry", () => {
    const code = signAppleWalletCode(USER, "2026-12-31", SECRET);
    const forged = code.replace("20261231", "20301231");
    expect(verifyMemberPassCode(forged, SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });
});

describe("dayColor", () => {
  it("is stable within an Oslo day and varies across days", () => {
    const morning = dayColor(new Date("2026-09-17T05:00:00Z"), SECRET);
    const evening = dayColor(new Date("2026-09-17T21:00:00Z"), SECRET);
    expect(evening).toEqual(morning);
    const names = new Set(
      Array.from(
        { length: 30 },
        (_, day) =>
          dayColor(new Date(Date.UTC(2026, 8, day + 1, 12)), SECRET).name
      )
    );
    expect(names.size).toBeGreaterThan(3);
    expect(morning.hex).toMatch(HEX_COLOR_RE);
  });
});

describe("isRecentDuplicate", () => {
  it("flags scans within ten minutes", () => {
    expect(isRecentDuplicate(null, NOW)).toBe(false);
    expect(
      isRecentDuplicate(new Date(NOW.getTime() - 9 * 60 * 1000), NOW)
    ).toBe(true);
    expect(
      isRecentDuplicate(new Date(NOW.getTime() - 11 * 60 * 1000), NOW)
    ).toBe(false);
  });
});
