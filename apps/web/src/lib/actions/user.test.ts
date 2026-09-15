import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  deleteIdentity: vi.fn(),
  get: vi.fn(),
  listIdentities: vi.fn(),
  updateName: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
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
  SESSION_COOKIE: "a_session_biso_web",
}));

import { removeIdentity, updateProfile } from "./user";

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

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    account.get.mockResolvedValue({ $id: "user-1" });
    account.updateName.mockResolvedValue({});
    adminDb.updateRow.mockResolvedValue({ $id: "user-1" });
    adminDb.createRow.mockResolvedValue({ $id: "user-1" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("writes only self-service fields to an existing row, through the admin client", async () => {
    adminDb.getRow.mockResolvedValue({ $id: "user-1" });

    await updateProfile({
      bi_employee_id: "1015882",
      name: "Ada",
      phone: "12345678",
      student_id: "s1715738",
    } as never);

    expect(adminDb.updateRow).toHaveBeenCalledWith("app", "user", "user-1", {
      name: "Ada",
      phone: "12345678",
    });
    expect(account.updateName).toHaveBeenCalledWith("Ada");
  });

  it("creates a missing row readable by its owner only", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 })
    );

    await updateProfile({ name: "Ada", student_id: "s1715738" } as never);

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      { name: "Ada" },
      ['read("user:user-1")']
    );
  });

  it("does not create a row when the lookup fails for another reason", async () => {
    adminDb.getRow.mockRejectedValue(
      Object.assign(new Error("timeout"), { code: 500 })
    );

    await expect(updateProfile({ name: "Ada" } as never)).resolves.toBeNull();
    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
