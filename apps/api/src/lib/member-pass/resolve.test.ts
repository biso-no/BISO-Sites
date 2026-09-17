import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const getRow = vi.hoisted(() => vi.fn());
const getMembershipStatusForStudent = vi.hoisted(() => vi.fn());
const createAuthenticatedClient = vi.hoisted(() =>
  vi.fn(async () => ({ account }))
);

vi.mock("server-only", () => ({}));
// Keep the real `extractJwtFromRequest` (a pure header check) so the
// resolver's "no Bearer header" guard is exercised for real; only
// `createAuthenticatedClient` is mocked.
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  createAuthenticatedClient,
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { getRow } })),
}));
vi.mock("@/lib/membership-status-cache", () => ({
  getMembershipStatusForStudent,
}));

import { resolveMemberPassForRequest } from "./resolve";

const MEMBERSHIP = {
  category: "113178",
  expiryDate: "2026-12-31",
  id: "71",
  name: "BISO Membership fall 2026",
  startDate: "2026-08-01",
};

function status(overrides: Record<string, unknown> = {}) {
  return {
    checkedAt: Date.parse("2026-09-15T08:00:00.000Z"),
    expiredMemberships: [],
    finagoCategoryIds: [],
    isMember: false,
    memberships: [],
    reason: "no_categories",
    ...overrides,
  };
}

function request(
  headers: Record<string, string> = { authorization: "Bearer jwt" }
) {
  return new Request("https://api.biso.no/api/member-pass", {
    headers,
  }) as never;
}

describe("resolveMemberPassForRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue({ $id: "user-1", name: "Account Name" });
    getRow.mockResolvedValue({ name: "Profile Name", student_id: "s1715738" });
    getMembershipStatusForStudent.mockResolvedValue(
      status({
        isMember: true,
        memberships: [MEMBERSHIP],
        reason: undefined,
      })
    );
  });

  it("reports unauthenticated when the JWT is invalid", async () => {
    account.get.mockRejectedValueOnce(new Error("bad jwt"));

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({ state: "unauthenticated" });
    expect(getRow).not.toHaveBeenCalled();
  });

  it("reports unauthenticated with no Authorization header, without falling back to a session cookie", async () => {
    const resolved = await resolveMemberPassForRequest(request({}));

    expect(resolved).toEqual({ state: "unauthenticated" });
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
    expect(getRow).not.toHaveBeenCalled();
  });

  it("reports unauthenticated for a non-Bearer Authorization header", async () => {
    const resolved = await resolveMemberPassForRequest(
      request({ authorization: "Basic dXNlcjpwYXNz" })
    );

    expect(resolved).toEqual({ state: "unauthenticated" });
    expect(createAuthenticatedClient).not.toHaveBeenCalled();
  });

  it("treats a missing profile row (404) as no BI identity", async () => {
    getRow.mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 })
    );

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({ state: "no_bi_identity" });
    expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
  });

  it("reports unavailable when the profile read fails unexpectedly", async () => {
    getRow.mockRejectedValue(
      Object.assign(new Error("timeout"), { code: 500 })
    );

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({ state: "unavailable" });
  });

  it("reports no BI identity for an unlinked profile", async () => {
    getRow.mockResolvedValue({ name: "Profile Name", student_id: null });

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({ state: "no_bi_identity" });
    expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
  });

  it("passes the sanitized student number to the membership status cache", async () => {
    await resolveMemberPassForRequest(request());

    expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738);
  });

  it("reports the mapped state for a non-member", async () => {
    getMembershipStatusForStudent.mockResolvedValue(
      status({ isMember: false, reason: "expired" })
    );

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({ state: "expired" });
  });

  it("builds the holder for an active member, preferring the profile name", async () => {
    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toEqual({
      holder: {
        expiryDate: "2026-12-31",
        membershipName: "BISO Membership fall 2026",
        name: "Profile Name",
        startDate: "2026-08-01",
        term: {
          duration: "semester",
          fromYear: 2026,
          season: "fall",
          toYear: 2026,
        },
      },
      state: "active",
      userId: "user-1",
    });
  });

  it("falls back to the account name when the profile has none", async () => {
    getRow.mockResolvedValue({ name: null, student_id: "s1715738" });

    const resolved = await resolveMemberPassForRequest(request());

    expect(resolved).toMatchObject({
      holder: expect.objectContaining({ name: "Account Name" }),
    });
  });
});
