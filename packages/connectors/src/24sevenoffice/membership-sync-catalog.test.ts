import { expect, mock, test } from "bun:test";

const createRow = mock(async () => ({}));
const updateRow = mock(async () => ({}));
const getRow = mock(async () => {
  throw Object.assign(new Error("not found"), { code: 404 });
});

mock.module("@repo/api/server", () => ({
  createAdminClient: async () => ({ db: { createRow, getRow, updateRow } }),
}));
// Mocked at the SOAP-client level (like the other connector tests) so the
// real products/categories modules run; module mocks are process-wide.
mock.module("./auth", () => ({
  getValidSession: async () => "session-token",
}));
mock.module("./client", () => ({
  createAuthenticatedClient: async () => ({
    GetCategoriesAsync: async () => [
      {
        GetCategoriesResult: {
          Category: [{ Id: 113_176, Name: "BISO Membership fall 2026" }],
        },
      },
    ],
    GetProductsAsync: async () => [
      {
        GetProductsResult: {
          Product: [
            { Id: 54, Name: "BISO Membership fall 2026", Price: 350 },
            { Id: 999, Name: "BISO Membership gift card", Price: 100 },
          ],
        },
      },
    ],
  }),
}));

const { syncMembershipCatalog } = await import("./membership-sync");

test("writes season products and skips a product with no season in its name", async () => {
  const result = await syncMembershipCatalog();
  expect(result).toEqual({ created: 1, skipped: 1, updated: 0 });
  expect(createRow).toHaveBeenCalledTimes(1);
  expect(createRow.mock.calls[0]).toEqual([
    "app",
    "memberships",
    "54",
    expect.objectContaining({
      canPurchase: false,
      category: "113176",
      expiryDate: "2026-12-31",
      price: 350,
      startDate: "2026-07-01",
    }),
  ]);
});
