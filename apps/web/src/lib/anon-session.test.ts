import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const adminAccount = vi.hoisted(() => ({
  createAnonymousSession: vi.fn(),
}));

const createSessionClient = vi.hoisted(() => vi.fn(async () => ({ account })));

const cookieStore = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ account: adminAccount })),
  createSessionClient,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { ensureAnonymousSession } from "./anon-session";

describe("ensureAnonymousSession", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminAccount.createAnonymousSession.mockReset();
    createSessionClient.mockClear();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
  });

  it("keeps a valid existing session and validates via the cookie path, not setJWT", async () => {
    cookieStore.get.mockReturnValue({ value: "session-secret" });
    account.get.mockResolvedValue({ $id: "user-1" });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    // The session secret must NOT be passed as the JWT argument — a no-arg
    // call reads the cookie via setSession instead.
    expect(createSessionClient).toHaveBeenCalledWith();
    expect(cookieStore.delete).not.toHaveBeenCalled();
    expect(adminAccount.createAnonymousSession).not.toHaveBeenCalled();
  });

  it("deletes a dead cookie and mints a fresh anonymous session", async () => {
    cookieStore.get.mockReturnValue({ value: "stale-secret" });
    account.get.mockRejectedValue(new Error("user deleted"));
    adminAccount.createAnonymousSession.mockResolvedValue({
      secret: "new-secret",
    });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    expect(cookieStore.delete).toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalledWith(
      expect.any(String),
      "new-secret",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("mints a session when no cookie exists", async () => {
    cookieStore.get.mockReturnValue(undefined);
    adminAccount.createAnonymousSession.mockResolvedValue({
      secret: "fresh-secret",
    });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    expect(createSessionClient).not.toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalled();
  });
});
