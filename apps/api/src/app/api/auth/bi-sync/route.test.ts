import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const listSessions = vi.hoisted(() => vi.fn());
const syncBiStudentIdentityAfterSignIn = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
  extractJwtFromRequest: (req: Request) =>
    req.headers.get("authorization")?.slice(7),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ users: { listSessions } })),
}));
vi.mock("@repo/shared/utils/bi-identity-sync", () => ({
  syncBiStudentIdentityAfterSignIn,
}));

import { POST } from "./route";

function jwtWith(payload: unknown): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

function request(jwt?: string) {
  return new Request("https://api.test/api/auth/bi-sync", {
    headers: jwt ? { authorization: `Bearer ${jwt}` } : {},
    method: "POST",
  }) as unknown as NextRequest;
}

/** The user's sessions as the admin client lists them. */
function sessionsAre(...sessions: Array<{ $id: string; provider: string }>) {
  listSessions.mockResolvedValue({ sessions, total: sessions.length });
}

const SYNC_RESULT = {
  campusHint: "2",
  hasEmployeeId: true,
  studentId: "s1715738",
  success: true,
};

describe("POST /api/auth/bi-sync", () => {
  beforeEach(() => {
    account.get.mockReset();
    listSessions.mockReset();
    syncBiStudentIdentityAfterSignIn.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    account.get.mockResolvedValue({ $id: "user-1" });
    sessionsAre(
      { $id: "session-1", provider: "oauth2" },
      { $id: "session-password", provider: "email" }
    );
    syncBiStudentIdentityAfterSignIn.mockResolvedValue(SYNC_RESULT);
  });

  it("401 without a bearer token", async () => {
    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Authentication required",
      success: false,
    });
    expect(syncBiStudentIdentityAfterSignIn).not.toHaveBeenCalled();
  });

  it("401 when Appwrite rejects the JWT", async () => {
    account.get.mockRejectedValue(new Error("invalid jwt"));

    const response = await POST(
      request(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    );

    expect(response.status).toBe(401);
    expect(syncBiStudentIdentityAfterSignIn).not.toHaveBeenCalled();
  });

  it("syncs the JWT's user and passes its oauth2 session as currentSessionId", async () => {
    const response = await POST(
      request(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SYNC_RESULT);
    expect(listSessions).toHaveBeenCalledWith({ userId: "user-1" });
    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {
      currentSessionId: "session-1",
    });
  });

  it("passes an oidc session as currentSessionId", async () => {
    sessionsAre({ $id: "session-1", provider: "oidc" });

    await POST(request(jwtWith({ sessionId: "session-1", userId: "user-1" })));

    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {
      currentSessionId: "session-1",
    });
  });

  it("does not let a password session claim the lockout", async () => {
    await POST(
      request(jwtWith({ sessionId: "session-password", userId: "user-1" }))
    );

    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {});
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not let a magic-url session claim the lockout", async () => {
    sessionsAre({ $id: "session-link", provider: "magic-url" });

    await POST(
      request(jwtWith({ sessionId: "session-link", userId: "user-1" }))
    );

    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {});
  });

  it("omits currentSessionId when the session is not one of the user's", async () => {
    await POST(
      request(jwtWith({ sessionId: "session-elsewhere", userId: "user-1" }))
    );

    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {});
  });

  it("omits currentSessionId when the sessions cannot be listed", async () => {
    listSessions.mockRejectedValue(new Error("appwrite down"));

    const response = await POST(
      request(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    );

    expect(await response.json()).toEqual(SYNC_RESULT);
    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {});
  });

  it("omits currentSessionId when the JWT names another user", async () => {
    await POST(request(jwtWith({ sessionId: "session-9", userId: "user-2" })));

    expect(listSessions).not.toHaveBeenCalled();
    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {});
  });

  it("returns sync_failed when the sync throws", async () => {
    syncBiStudentIdentityAfterSignIn.mockRejectedValue(new Error("boom"));

    const response = await POST(
      request(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      error: "sync_failed",
      success: false,
    });
  });
});
