import { describe, expect, it } from "vitest";
import { oauthReturnDestination, readBiLoginFailure } from "./bi-login";

const params = (entries: Record<string, string>) => ({
  get: (name: string) => entries[name] ?? null,
});

describe("readBiLoginFailure", () => {
  it("is null unless the page is the BI failure leg", () => {
    expect(readBiLoginFailure(params({}))).toBeNull();
    expect(
      readBiLoginFailure(params({ error: '{"type":"general_bad_request"}' }))
    ).toBeNull();
  });

  it("recognises the existing-account refusal Appwrite sends", () => {
    expect(
      readBiLoginFailure(
        params({
          bi_login: "failed",
          error: JSON.stringify({
            code: 400,
            message: "Bad request",
            type: "general_bad_request",
          }),
        })
      )
    ).toBe("existing_account");
  });

  it("treats every other failure, and a missing or malformed error, as generic", () => {
    expect(
      readBiLoginFailure(
        params({
          bi_login: "failed",
          error: '{"type":"user_oauth2_bad_request"}',
        })
      )
    ).toBe("failed");
    expect(readBiLoginFailure(params({ bi_login: "failed" }))).toBe("failed");
    expect(readBiLoginFailure(params({ bi_login: "failed", error: "{" }))).toBe(
      "failed"
    );
    expect(
      readBiLoginFailure(params({ bi_login: "failed", error: "42" }))
    ).toBe("failed");
  });
});

describe("oauthReturnDestination", () => {
  it("sends a returning account where it was headed", () => {
    expect(
      oauthReturnDestination({
        hadProfile: true,
        linkedBi: true,
        redirectTo: "/membership/join",
      })
    ).toBe("/membership/join");
  });

  it("sends a brand-new student through onboarding with the BI step done", () => {
    expect(
      oauthReturnDestination({
        hadProfile: false,
        linkedBi: true,
        redirectTo: "/events",
      })
    ).toBe("/onboarding?linked=1");
  });

  it("sends a brand-new non-student through plain onboarding", () => {
    expect(
      oauthReturnDestination({
        hadProfile: false,
        linkedBi: false,
        redirectTo: "/",
      })
    ).toBe("/onboarding");
  });
});
