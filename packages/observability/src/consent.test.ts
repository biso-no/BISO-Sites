import { describe, expect, it } from "vitest";
import {
  parseReplayConsent,
  replayConsentCookieOptions,
  serializeReplayConsent,
} from "./consent";

describe("parseReplayConsent", () => {
  it("reads granted and denied among other cookies", () => {
    expect(parseReplayConsent("a=1; biso_replay_consent=v1:granted; b=2")).toBe(
      "granted"
    );
    expect(parseReplayConsent("biso_replay_consent=v1:denied")).toBe("denied");
  });

  it.each([
    "biso_replay_consent=v0:granted",
    "biso_replay_consent=granted",
    "biso_replay_consent=garbage",
    "other=v1:granted",
    "",
  ])("treats %j as no answer", (cookie) => {
    expect(parseReplayConsent(cookie)).toBe("unknown");
  });

  it("treats a missing cookie string as no answer", () => {
    expect(parseReplayConsent(undefined)).toBe("unknown");
  });
});

describe("serializeReplayConsent", () => {
  it("prefixes the version", () => {
    expect(serializeReplayConsent("granted")).toBe("v1:granted");
    expect(serializeReplayConsent("denied")).toBe("v1:denied");
  });
});

describe("replayConsentCookieOptions", () => {
  it("scopes to .biso.no and secure in production", () => {
    expect(replayConsentCookieOptions(true)).toEqual({
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      secure: true,
      httpOnly: false,
      domain: ".biso.no",
    });
  });

  it("is host-only and not secure outside production", () => {
    expect(replayConsentCookieOptions(false)).toEqual({
      path: "/",
      maxAge: 31_536_000,
      sameSite: "lax",
      secure: false,
      httpOnly: false,
      domain: undefined,
    });
  });
});
