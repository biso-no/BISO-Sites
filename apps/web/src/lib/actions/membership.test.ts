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

vi.mock("next/cache", () => ({
  // Run the cached callback directly and treat tag revalidation as a no-op so
  // the test exercises the real computation path without a Next request store.
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
  revalidateTag: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ account, db })),
  createAdminClient: vi.fn(async () => ({ db })),
}));

vi.mock("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories,
}));

vi.mock("@/lib/auth-utils", () => ({
  isAuthenticatedAccount: vi.fn(() => true),
}));

// Membership now resolves the account through the request-memoized
// getLoggedInUser(); this suite tests the Finago/caching logic, so user
// resolution is stubbed as an authenticated member with a student id.
vi.mock("@/lib/actions/user", () => ({
  getLoggedInUser: vi.fn(async () => ({
    user: { $id: "user-1" },
    profile: { student_id: "BI-12345" },
  })),
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
