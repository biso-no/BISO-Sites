import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  deleteIdentity: vi.fn(),
  get: vi.fn(),
  listIdentities: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const revalidateTag = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account })),
}));

vi.mock("next/cache", () => ({
  revalidateTag,
}));

// removeIdentity() never touches these, but they are real value imports of
// ./user.ts (used by _getLoggedInUser), so the module graph needs them
// resolvable — mocked the same way apps/web/src/app/actions/member-portal.test.ts
// mocks @/lib/auth-utils for the same reason.
vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => true),
}));

vi.mock("@/lib/cookie-prefs", () => ({
  SESSION_COOKIE: "a_session_biso",
}));

import { removeIdentity } from "./user";

function oidcIdentity(id = "identity-oidc") {
  return { $id: id, provider: "oidc", providerEmail: "s1715738@bi.no" };
}

function emailIdentity(id = "identity-email") {
  return { $id: id, provider: "email", providerEmail: "person@example.com" };
}

describe("removeIdentity", () => {
  beforeEach(() => {
    account.deleteIdentity.mockReset();
    account.get.mockReset();
    account.listIdentities.mockReset();
    adminDb.getRow.mockReset();
    adminDb.updateRow.mockReset();
    revalidateTag.mockReset();

    account.get.mockResolvedValue({ $id: "user-1" });
    account.deleteIdentity.mockResolvedValue({});
    adminDb.getRow.mockResolvedValue({ student_id: "s1715738" });
    adminDb.updateRow.mockResolvedValue({});
  });

  it("clears student_id and bi_* fields when the removed identity is the OIDC one", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("identity-oidc"), emailIdentity()],
    });

    const result = await removeIdentity("identity-oidc");

    expect(result).toEqual({ success: true });
    expect(account.deleteIdentity).toHaveBeenCalledWith("identity-oidc");
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({
        bi_campus_id: null,
        bi_employee_id: null,
        bi_linked_at: null,
        student_id: null,
      })
    );
    expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
      expire: 0,
    });
  });

  it("does not touch student_id when the removed identity is not the OIDC one", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity(), emailIdentity("identity-email")],
    });

    const result = await removeIdentity("identity-email");

    expect(result).toEqual({ success: true });
    expect(account.deleteIdentity).toHaveBeenCalledWith("identity-email");
    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
