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

const publicBenefits = vi.hoisted(() => ({
  getPublicBenefits: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account, db: adminDb })),
}));
vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn((user: unknown) => user !== null),
}));
vi.mock("@/lib/actions/membership", () => membership);
vi.mock("@/lib/data/benefits", () => publicBenefits);

import type { PublicBenefit } from "@repo/shared/utils/benefit-public";
import {
  getFeaturedBenefits,
  getMemberPortalBenefits,
  revealBenefit,
} from "./member-portal";

const SECRET_CODE = "SECRET-CODE-123";

const benefit = (overrides: Partial<PublicBenefit>): PublicBenefit => ({
  campusId: "5",
  category: "food_drink",
  createdAt: "2026-01-01T00:00:00.000Z",
  description: { en: null, nb: null },
  id: "benefit-1",
  imageUrl: null,
  isFeatured: false,
  partner: null,
  publishEnd: null,
  redemptionType: "code",
  section: "member",
  sortOrder: 0,
  terms: { en: null, nb: null },
  title: { en: "Free coffee", nb: "Gratis kaffe" },
  ...overrides,
});

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

  it("refuses a visitor who is not signed in without any read", async () => {
    account.get.mockRejectedValue(new Error("401"));

    expect(await revealBenefit("benefit-1")).toEqual({
      success: false,
      reason: "not_member",
    });
    expect(membership.getLiveMembershipStatus).not.toHaveBeenCalled();
    expect(adminDb.getRow).not.toHaveBeenCalled();
    expect(rowsFor("benefit_codes")).toHaveLength(0);
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
  beforeEach(() => {
    publicBenefits.getPublicBenefits.mockReset();
    publicBenefits.getPublicBenefits.mockResolvedValue([
      benefit({ id: "national", campusId: "5" }),
      benefit({ id: "oslo", campusId: "1", isFeatured: true }),
      benefit({ id: "bergen", campusId: "2", isFeatured: true }),
      benefit({ id: "career", campusId: "5", section: "career" }),
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
    publicBenefits.getPublicBenefits.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) =>
        benefit({ id: `f${i}`, isFeatured: true })
      )
    );

    expect(await getFeaturedBenefits("1")).toHaveLength(6);

    publicBenefits.getPublicBenefits.mockResolvedValue([
      benefit({ id: "plain" }),
      benefit({ id: "star", isFeatured: true }),
    ]);
    expect((await getFeaturedBenefits("1")).map((b) => b.id)).toEqual(["star"]);
  });

  it("falls back to an empty list when the benefit read fails", async () => {
    publicBenefits.getPublicBenefits.mockRejectedValue(new Error("down"));

    expect(await getMemberPortalBenefits("1")).toEqual([]);
    expect(await getFeaturedBenefits("1")).toEqual([]);
  });

  it("carries no redemption value or code anywhere in the payload", async () => {
    publicBenefits.getPublicBenefits.mockResolvedValue([
      benefit({
        description: { en: "Show your card", nb: null },
        isFeatured: true,
        partner: {
          id: "p1",
          logoUrl: null,
          name: "Cafe",
          websiteUrl: null,
        },
      }),
    ]);

    const keys: string[] = [];
    const strings: string[] = [];
    collectStrings(await getMemberPortalBenefits("1"), keys, strings);
    collectStrings(await getFeaturedBenefits("1"), keys, strings);

    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toContain("redemption_value");
    expect(keys).not.toContain("redemptionValue");
    expect(strings).not.toContain(SECRET_CODE);
  });
});
