import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

const account = vi.hoisted(() => ({
  get: vi.fn(),
}));

const db = vi.hoisted(() => ({
  getRow: vi.fn(),
  listRows: vi.fn(),
}));

const getCustomerCategories = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ account, db })),
}));

vi.mock("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories,
}));

vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => true),
}));

import { refreshMembershipStatus } from "./membership";

describe("membership actions", () => {
  beforeEach(() => {
    vi.stubEnv("MEMBERSHIP_FINAGO_TIMEOUT_MS", "20");
    cookieStore.get.mockImplementation((name: string) => {
      if (name === "a_session_biso") {
        return { value: "session" };
      }
      return undefined;
    });
    account.get.mockResolvedValue({ $id: "user-1" });
    db.getRow.mockResolvedValue({ student_id: "BI-12345" });
    db.listRows.mockResolvedValue({
      rows: [
        {
          $id: "membership-1",
          category: "123",
          expiryDate: "2027-01-01",
          name: "BISO Membership",
          startDate: "2026-01-01",
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    cookieStore.delete.mockReset();
    cookieStore.get.mockReset();
    cookieStore.set.mockReset();
    account.get.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    getCustomerCategories.mockReset();
  });

  it("falls back when the Finago membership category lookup exceeds its deadline", async () => {
    getCustomerCategories.mockImplementation(
      () =>
        new Promise<number[]>((resolve) => {
          setTimeout(() => {
            resolve([123]);
          }, 100);
        })
    );

    await expect(refreshMembershipStatus()).resolves.toMatchObject({
      finagoCategoryIds: [],
      isMember: false,
      memberships: [],
      reason: "finago_error",
    });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});
