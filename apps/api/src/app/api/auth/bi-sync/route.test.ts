import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const syncBiStudentIdentityAfterSignIn = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
  extractJwtFromRequest: (req: Request) =>
    req.headers.get("authorization")?.slice(7),
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

const SYNC_RESULT = {
  campusHint: "2",
  hasEmployeeId: true,
  studentId: "s1715738",
  success: true,
};

describe("POST /api/auth/bi-sync", () => {
  beforeEach(() => {
    account.get.mockReset();
    syncBiStudentIdentityAfterSignIn.mockReset();
    account.get.mockResolvedValue({ $id: "user-1" });
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

  it("syncs the JWT's user and passes the JWT's session as currentSessionId", async () => {
    const response = await POST(
      request(jwtWith({ sessionId: "session-1", userId: "user-1" }))
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SYNC_RESULT);
    expect(syncBiStudentIdentityAfterSignIn).toHaveBeenCalledWith("user-1", {
      currentSessionId: "session-1",
    });
  });

  it("omits currentSessionId when the JWT names another user", async () => {
    await POST(request(jwtWith({ sessionId: "session-9", userId: "user-2" })));

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
