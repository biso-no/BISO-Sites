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
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "./cookie-prefs";

/** Mock `cookies().get()` per cookie name rather than for every name at once. */
function mockCookies(present: Record<string, string>) {
  cookieStore.get.mockImplementation((name: string) =>
    name in present ? { value: present[name] } : undefined
  );
}

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
    mockCookies({ [SESSION_COOKIE]: "session-secret" });
    account.get.mockResolvedValue({ $id: "user-1" });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    // The session secret must NOT be passed as the JWT argument — a no-arg
    // call reads the cookie via setSession instead.
    expect(createSessionClient).toHaveBeenCalledWith();
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(adminAccount.createAnonymousSession).not.toHaveBeenCalled();
  });

  it("expires a dead cookie with attributes that match, then mints a fresh session", async () => {
    mockCookies({ [SESSION_COOKIE]: "stale-secret" });
    account.get.mockRejectedValue(new Error("user deleted"));
    adminAccount.createAnonymousSession.mockResolvedValue({
      secret: "new-secret",
    });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    // A bare cookies().delete(name) omits the domain and silently no-ops on a
    // `.biso.no`-scoped cookie, so expiry must go through set() with maxAge 0.
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "new-secret",
      expect.objectContaining({ httpOnly: true })
    );
  });

  it("mints a session when no cookie exists", async () => {
    mockCookies({});
    adminAccount.createAnonymousSession.mockResolvedValue({
      secret: "fresh-secret",
    });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    expect(createSessionClient).not.toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalled();
  });

  it("carries a pre-rename session onto the current cookie name and retires the legacy one", async () => {
    // `a_session_biso` is Appwrite's own cookie name for project `biso`; while
    // it is scoped to `.biso.no` the browser replays it to appwrite.biso.no and
    // breaks admin OAuth with 409 user_already_exists.
    mockCookies({ [LEGACY_SESSION_COOKIE]: "pre-rename-secret" });
    account.get.mockResolvedValue({ $id: "user-1" });

    const result = await ensureAnonymousSession();

    expect(result).toBe(true);
    // Session survives the rename — no forced re-login.
    expect(adminAccount.createAnonymousSession).not.toHaveBeenCalled();
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "pre-rename-secret",
      expect.objectContaining({ httpOnly: true })
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      LEGACY_SESSION_COOKIE,
      "",
      expect.objectContaining({ maxAge: 0 })
    );
  });

  it("does not touch the legacy cookie when it is absent", async () => {
    mockCookies({ [SESSION_COOKIE]: "session-secret" });
    account.get.mockResolvedValue({ $id: "user-1" });

    await ensureAnonymousSession();

    expect(cookieStore.set).not.toHaveBeenCalledWith(
      LEGACY_SESSION_COOKIE,
      "",
      expect.anything()
    );
  });
});
