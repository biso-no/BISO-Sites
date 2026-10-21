import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

const adminDb = vi.hoisted(() => ({
  createRow: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: adminDb })),
  createSessionClient: vi.fn(async () => ({ account, db: sessionDb })),
}));

vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => true),
}));

import { Query } from "@repo/api";
import {
  getFeaturedBenefits,
  getMemberPortalBenefits,
  revealBenefit,
} from "./member-portal";

describe("member portal benefit reveals", () => {
  beforeEach(() => {
    account.get.mockReset();
    adminDb.createRow.mockReset();
    sessionDb.createRow.mockReset();
    sessionDb.getRow.mockReset();
    sessionDb.listRows.mockReset();

    account.get.mockResolvedValue({ $id: "member-user-1" });
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
    sessionDb.getRow.mockResolvedValue({
      $id: "benefit-1",
      campus_id: "1",
      redemption_value: "CODE123",
    });
    adminDb.createRow.mockResolvedValue({});
  });

  it("records reveals and interactions through the admin client with user permissions", async () => {
    const result = await revealBenefit("benefit-1");

    expect(result).toEqual({ success: true, value: "CODE123" });
    expect(sessionDb.createRow).not.toHaveBeenCalled();
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
    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "benefit_interactions",
      expect.any(String),
      expect.objectContaining({
        action: "reveal",
        benefit_id: "benefit-1",
        user_id: "member-user-1",
      }),
      ['read("user:member-user-1")']
    );
  });
});

describe("member portal benefit listing", () => {
  const memberSectionQuery = Query.or([
    Query.equal("section", "member"),
    Query.isNull("section"),
  ]);

  beforeEach(() => {
    sessionDb.listRows.mockReset();
    sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  it("lists only member-section (or unsectioned) benefits", async () => {
    await getMemberPortalBenefits("2");

    expect(sessionDb.listRows).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.arrayContaining([memberSectionQuery])
    );
  });

  it("features only member-section (or unsectioned) benefits", async () => {
    await getFeaturedBenefits("2");

    expect(sessionDb.listRows).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.arrayContaining([memberSectionQuery])
    );
  });
});
