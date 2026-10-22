import { beforeEach, describe, expect, it, vi } from "vitest";

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const membership = vi.hoisted(() => ({
  getLiveMembershipStatus: vi.fn(),
}));

const publicDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createPublicClient: vi.fn(async () => ({ db: publicDb })),
  createSessionClient: vi.fn(async () => ({ account, db: adminDb })),
}));
vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => authState.authenticated),
}));
vi.mock("@/lib/actions/membership", () => membership);
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: vi.fn(() => Promise.resolve()),
}));
const authState = vi.hoisted(() => ({ authenticated: true }));

import {
  getFeaturedBenefits,
  getMemberPortalBenefits,
  revealBenefit,
} from "./member-portal";

const SECRET_CODE = "SECRET-CODE-123";

const rowsFor = (table: string) =>
  adminDb.listRows.mock.calls.filter((call) => call[0] === table);

describe("revealBenefit", () => {
  beforeEach(() => {
    for (const fn of [
      account.get,
      adminDb.createRow,
      adminDb.getRow,
      adminDb.listRows,
      membership.getLiveMembershipStatus,
    ]) {
      fn.mockReset();
    }
    authState.authenticated = true;
    account.get.mockResolvedValue({ $id: "member-user-1" });
    membership.getLiveMembershipStatus.mockResolvedValue({ isMember: true });
    adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    adminDb.createRow.mockResolvedValue({});
    adminDb.getRow.mockImplementation(
      (_db: string, table: string, id: string) =>
        Promise.resolve(
          table === "benefit_codes"
            ? { $id: id, value: SECRET_CODE }
            : {
                $id: id,
                campus_id: "1",
                redemption_type: "code",
                section: "member",
                status: "published",
              }
        )
    );
  });

  it("returns the code to an active member and reads benefit_codes", async () => {
    const result = await revealBenefit("benefit-1");

    expect(result).toEqual({ success: true, value: SECRET_CODE });
    expect(adminDb.getRow).toHaveBeenCalledWith(
      "app",
      "benefit_codes",
      "benefit-1"
    );
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "benefit_reveals",
      expect.any(String),
      expect.objectContaining({
        benefit_id: "benefit-1",
        user_id: "member-user-1",
      }),
      ['read("user:member-user-1")', 'update("user:member-user-1")']
    );
  });

  it("refuses a non-member without reading any code", async () => {
    membership.getLiveMembershipStatus.mockResolvedValue({
      isMember: false,
      reason: "not_member",
    });

    const result = await revealBenefit("benefit-1");

    expect(result).toEqual({ success: false, reason: "not_member" });
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  it("reports a membership outage as unavailable, not as not a member", async () => {
    membership.getLiveMembershipStatus.mockResolvedValue({
      isMember: false,
      reason: "api_unavailable",
    });

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "unavailable",
    });
    expect(adminDb.getRow).not.toHaveBeenCalled();
  });

  it("treats a thrown membership check as unavailable", async () => {
    membership.getLiveMembershipStatus.mockRejectedValue(new Error("boom"));

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "unavailable",
    });
    expect(adminDb.getRow).not.toHaveBeenCalled();
  });

  it("refuses a visitor with no session (401) without any read", async () => {
    account.get.mockRejectedValue({ code: 401 });

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "not_member",
    });
    expect(membership.getLiveMembershipStatus).not.toHaveBeenCalled();
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(rowsFor("benefit_codes")).toHaveLength(0);
  });

  it.each([
    ["a 503", { code: 503 }],
    ["a network error", new Error("fetch failed")],
  ])("reports %s on the session check as unavailable", async (_name, error) => {
    account.get.mockRejectedValue(error);

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "unavailable",
    });
    expect(membership.getLiveMembershipStatus).not.toHaveBeenCalled();
    expect(adminDb.getRow).not.toHaveBeenCalled();
  });

  it("refuses an anonymous session without a membership call or code read", async () => {
    authState.authenticated = false;

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "not_member",
    });
    expect(membership.getLiveMembershipStatus).not.toHaveBeenCalled();
    expect(adminDb.getRow).not.toHaveBeenCalled();
  });

  it("never touches the admin client for a non-member", async () => {
    membership.getLiveMembershipStatus.mockResolvedValue({ isMember: false });
    const { createAdminClient } = await import("@repo/api/server");
    vi.mocked(createAdminClient).mockClear();

    await revealBenefit("benefit-1");

    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("passes a not_found result through", async () => {
    adminDb.getRow.mockRejectedValue({ code: 404 });

    expect(await revealBenefit("missing")).toEqual({
      success: false,
      reason: "not_found",
    });
  });

  it("never throws and exposes no code when the backend fails", async () => {
    adminDb.getRow.mockRejectedValue(new Error("db down"));

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "unavailable",
    });
  });
});

function collectStrings(value: unknown, keys: string[], strings: string[]) {
  if (typeof value === "string") {
    strings.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, keys, strings);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      keys.push(key);
      collectStrings(inner, keys, strings);
    }
  }
}

describe("member portal benefit listing", () => {
  const row = (id: string, overrides: Record<string, unknown> = {}) => ({
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: id,
    campus_id: "5",
    section: "member",
    sort_order: 0,
    status: "published",
    title_en: `Title ${id}`,
    title_nb: `Tittel ${id}`,
    ...overrides,
  });

  const serve = (rows: Record<string, unknown>[]) =>
    publicDb.listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows: table === "campus_benefits" ? rows : [],
        total: 0,
      })
    );

  beforeEach(() => {
    publicDb.listRows.mockReset();
    serve([
      row("national"),
      row("oslo", { campus_id: "1", is_featured: true }),
      row("bergen", { campus_id: "2", is_featured: true }),
      row("career", { section: "career" }),
    ]);
  });

  it("lists member-section benefits for the campus plus national", async () => {
    const result = await getMemberPortalBenefits("1");

    expect(result.map((b) => b.id).sort()).toEqual(["national", "oslo"]);
  });

  it("returns national benefits only when no campus is given", async () => {
    const result = await getMemberPortalBenefits(null);

    expect(result.map((b) => b.id)).toEqual(["national"]);
  });

  it("features only isFeatured member benefits, at most six", async () => {
    serve(
      Array.from({ length: 8 }, (_, i) => row(`f${i}`, { is_featured: true }))
    );
    expect(await getFeaturedBenefits("1")).toHaveLength(6);

    serve([row("plain"), row("star", { is_featured: true })]);
    expect((await getFeaturedBenefits("1")).map((b) => b.id)).toEqual(["star"]);
  });

  it("falls back to an empty list when the benefit read fails", async () => {
    publicDb.listRows.mockRejectedValue(new Error("down"));

    expect(await getMemberPortalBenefits("1")).toEqual([]);
    expect(await getFeaturedBenefits("1")).toEqual([]);
  });

  it("carries no redemption value or code anywhere in the payload", async () => {
    serve([
      row("coded", {
        is_featured: true,
        redemption_type: "code",
        redemption_value: SECRET_CODE,
      }),
    ]);

    const payload = [
      ...(await getMemberPortalBenefits("1")),
      ...(await getFeaturedBenefits("1")),
    ];
    const keys: string[] = [];
    const strings: string[] = [];
    collectStrings(payload, keys, strings);

    expect(payload).toHaveLength(2);
    expect(keys).not.toContain("redemption_value");
    expect(keys).not.toContain("redemptionValue");
    expect(strings).not.toContain(SECRET_CODE);
    expect(JSON.stringify(payload)).not.toContain(SECRET_CODE);
  });
});
