import { describe, expect, it } from "vitest";
import {
  generateGuestToken,
  hashGuestToken,
  isLinkUsable,
  resolveLinkExpiry,
} from "./guest-links";

const NOW = new Date("2026-09-17T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const GUEST_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

describe("guest link tokens", () => {
  it("are long, url-safe and unique", () => {
    const a = generateGuestToken();
    expect(a).toMatch(GUEST_TOKEN_SHAPE);
    expect(generateGuestToken()).not.toBe(a);
  });

  it("hash to stable hex", () => {
    expect(hashGuestToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});

describe("isLinkUsable", () => {
  it("requires an unexpired, unrevoked link", () => {
    const future = new Date(NOW.getTime() + HOUR).toISOString();
    const past = new Date(NOW.getTime() - 1).toISOString();
    expect(isLinkUsable({ expires_at: future, revoked_at: null }, NOW)).toBe(
      true
    );
    expect(isLinkUsable({ expires_at: past, revoked_at: null }, NOW)).toBe(
      false
    );
    expect(isLinkUsable({ expires_at: future, revoked_at: past }, NOW)).toBe(
      false
    );
    expect(isLinkUsable(null, NOW)).toBe(false);
  });
});

describe("resolveLinkExpiry", () => {
  it("defaults to six hours", () => {
    expect(resolveLinkExpiry(null, NOW)?.getTime()).toBe(
      NOW.getTime() + 6 * HOUR
    );
  });

  it("rejects the past and caps at 48 hours", () => {
    expect(resolveLinkExpiry(new Date(NOW.getTime() - HOUR), NOW)).toBeNull();
    expect(
      resolveLinkExpiry(new Date(NOW.getTime() + 72 * HOUR), NOW)?.getTime()
    ).toBe(NOW.getTime() + 48 * HOUR);
    expect(
      resolveLinkExpiry(new Date(NOW.getTime() + 3 * HOUR), NOW)?.getTime()
    ).toBe(NOW.getTime() + 3 * HOUR);
  });
});
