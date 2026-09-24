import { beforeEach, describe, expect, mock, test } from "bun:test";

let sessionCookie: { value: string } | undefined;
const accountGet = mock();

mock.module("next/headers", () => ({
  cookies: mock(async () => ({ get: () => sessionCookie })),
  headers: mock(async () => new Headers()),
}));

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({})),
  createSessionClient: mock(async () => ({ account: { get: accountGet } })),
}));

const { getAuthStatus } = await import("./auth-utils");

const LOGGED_OUT = {
  hasSession: false,
  isAuthenticated: false,
  isAnonymous: false,
};

describe("getAuthStatus", () => {
  beforeEach(() => {
    sessionCookie = { value: "secret" };
    accountGet.mockReset();
  });

  test("is logged-out without a session cookie", async () => {
    sessionCookie = undefined;
    expect(await getAuthStatus()).toEqual(LOGGED_OUT);
    expect(accountGet).not.toHaveBeenCalled();
  });

  test("is logged-out when Appwrite rejects the session (401)", async () => {
    accountGet.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), { code: 401 })
    );
    expect(await getAuthStatus()).toEqual(LOGGED_OUT);
  });

  test("rethrows backend failures instead of reporting logged-out", async () => {
    accountGet.mockRejectedValueOnce(
      Object.assign(new Error("Service unavailable"), { code: 503 })
    );
    await expect(getAuthStatus()).rejects.toThrow("Service unavailable");
  });

  test("rethrows network errors without an HTTP status", async () => {
    accountGet.mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getAuthStatus()).rejects.toThrow("fetch failed");
  });

  test("reports an authenticated user", async () => {
    accountGet.mockResolvedValueOnce({
      $id: "u1",
      email: "a@b.no",
      emailVerification: true,
      name: "Ada",
    });
    expect(await getAuthStatus()).toEqual({
      hasSession: true,
      isAuthenticated: true,
      isAnonymous: false,
    });
  });
});
