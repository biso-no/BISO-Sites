import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createSessionJwt = vi.hoisted(() => vi.fn());
const getLoggedInUser = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());
// React's `cache()` only memoizes inside a server render; stand in for one
// render per test so the per-request dedupe is observable.
const requestScope = vi.hoisted(() => ({ resets: [] as Array<() => void> }));

vi.mock("react", () => ({
  cache: <T>(fn: () => T) => {
    let hit = false;
    let value: T;
    requestScope.resets.push(() => {
      hit = false;
    });
    return () => {
      if (!hit) {
        hit = true;
        value = fn();
      }
      return value;
    };
  },
}));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
  createSessionJwt,
}));
vi.mock("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories: vi.fn(),
}));
vi.mock("@/lib/actions/user", () => ({ getLoggedInUser }));

import {
  getLiveMembershipStatus,
  getMembershipStatus,
  refreshMembershipStatus,
} from "./membership";

const API = "https://api.biso.test";

const MEMBER = {
  checkedAt: 1_790_000_000_000,
  expiredMemberships: [],
  finagoCategoryIds: [113_178],
  isMember: true,
  memberships: [
    {
      category: "113178",
      expiryDate: "2027-06-30",
      id: "71",
      name: "BISO Membership fall 2026 and spring 2027",
      startDate: "2026-07-01",
    },
  ],
  upcomingMemberships: [],
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("web membership actions", () => {
  beforeEach(() => {
    for (const reset of requestScope.resets) {
      reset();
    }
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", API);
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: "s1715738" },
      user: { $id: "user-1" },
    });
    createSessionJwt.mockResolvedValue("jwt-1");
    fetchMock.mockResolvedValue(reply(MEMBER));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
    createSessionJwt.mockReset();
    getLoggedInUser.mockReset();
  });

  it("reads the status from the api with the session JWT", async () => {
    await expect(getMembershipStatus()).resolves.toEqual(MEMBER);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/api/membership?view=status`);
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { Authorization: "Bearer jwt-1" },
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("asks the api once per request", async () => {
    await getMembershipStatus();
    await getMembershipStatus();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["refreshMembershipStatus", refreshMembershipStatus],
    ["getLiveMembershipStatus", getLiveMembershipStatus],
  ])("%s asks the api to refresh", async (_name, read) => {
    await read();

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API}/api/membership?view=status&refresh=1`
    );
  });

  it("does not call the api for a visitor who is not signed in", async () => {
    getLoggedInUser.mockResolvedValue(null);

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "not_authenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the api without a student id", async () => {
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: null },
      user: { $id: "user-1" },
    });

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "no_student_id",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the api with an unreadable student id", async () => {
    getLoggedInUser.mockResolvedValue({
      profile: { student_id: "no-digits" },
      user: { $id: "user-1" },
    });

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "invalid_student_id",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats a missing session JWT as signed out", async () => {
    createSessionJwt.mockResolvedValue(null);

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "not_authenticated",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports api_unavailable when minting the JWT fails", async () => {
    createSessionJwt.mockRejectedValue(new Error("appwrite down"));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("treats a 401 from the api as signed out", async () => {
    fetchMock.mockResolvedValue(reply({ message: "nope" }, 401));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "not_authenticated",
    });
  });

  it("reports api_unavailable on a server error", async () => {
    fetchMock.mockResolvedValue(reply({ message: "boom" }, 502));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable on a timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError")
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>"));

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the body is not a membership status", async () => {
    fetchMock.mockResolvedValue(
      reply({ isMember: true, state: "already_member" })
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "api_unavailable",
    });
  });

  it("reports api_unavailable when the api url is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");

    await expect(getMembershipStatus()).resolves.toMatchObject({
      reason: "api_unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the api's own failure reason through", async () => {
    fetchMock.mockResolvedValue(
      reply({
        ...MEMBER,
        isMember: false,
        memberships: [],
        reason: "finago_error",
      })
    );

    await expect(getMembershipStatus()).resolves.toMatchObject({
      isMember: false,
      reason: "finago_error",
    });
  });
});
