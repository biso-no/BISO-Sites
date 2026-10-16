import type { Models } from "@repo/api";
import { describe, expect, it, vi } from "vitest";

// `auth-utils` imports `next/headers` and `@repo/api/server` at module scope for
// `getAuthStatus`/`getUserPreferences`. `isAuthenticatedAccount` itself is pure,
// so stub the module-scope dependencies just enough for the import to resolve
// under the `node` test environment.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@repo/api/server", () => ({ createSessionClient: vi.fn() }));

const { isAuthenticatedAccount } = await import("./auth-utils");

/** Minimal account row — only the fields the predicate reads. */
const account = (
  overrides: Partial<Models.User<Models.Preferences>>
): Models.User<Models.Preferences> =>
  ({
    $id: "acct_1",
    email: "",
    emailVerification: false,
    name: "",
    ...overrides,
  }) as Models.User<Models.Preferences>;

describe("isAuthenticatedAccount", () => {
  it("rejects a null or undefined account", () => {
    expect(isAuthenticatedAccount(null)).toBe(false);
    expect(isAuthenticatedAccount(undefined)).toBe(false);
  });

  it("rejects an account with no $id", () => {
    expect(isAuthenticatedAccount(account({ $id: "" }))).toBe(false);
  });

  // The case the nav's Member Portal gate depends on: a lazily-provisioned
  // anonymous session has a real $id but no email and a generated `guest_*`
  // name, so it must never read as signed in.
  it("rejects an anonymous session (no email, guest_ name)", () => {
    expect(
      isAuthenticatedAccount(
        account({ email: "", name: "guest_8f21c", emailVerification: false })
      )
    ).toBe(false);
  });

  it("rejects a guest_ name even when the email is verified", () => {
    expect(
      isAuthenticatedAccount(
        account({ email: "", name: "guest_8f21c", emailVerification: true })
      )
    ).toBe(false);
  });

  it("rejects a bare session with neither email nor name", () => {
    expect(isAuthenticatedAccount(account({}))).toBe(false);
  });

  it("rejects an unverified real name with no email", () => {
    expect(
      isAuthenticatedAccount(
        account({ email: "", name: "Markus Heien", emailVerification: false })
      )
    ).toBe(false);
  });

  it("accepts an account with an email, even unverified", () => {
    expect(
      isAuthenticatedAccount(
        account({ email: "student@biso.no", emailVerification: false })
      )
    ).toBe(true);
  });

  it("accepts a verified real name with no email (OAuth-style account)", () => {
    expect(
      isAuthenticatedAccount(
        account({ email: "", name: "Markus Heien", emailVerification: true })
      )
    ).toBe(true);
  });
});
