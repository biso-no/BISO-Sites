import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildShopReversalTransactionInput: vi.fn(),
  postLedgerTransaction: vi.fn(),
}));

vi.mock("@repo/connectors/24sevenoffice", () => ({
  buildShopReversalTransactionInput: mocks.buildShopReversalTransactionInput,
  postLedgerTransaction: mocks.postLedgerTransaction,
}));

import { finagoRefundReverser } from "./finago-refund-reverser";

const SETTINGS_ROW = {
  general: JSON.stringify({
    clearingAccounts: { stripe: 1540, vipps: 1530 },
    transactionTypeNumber: 8,
  }),
};

const db = {
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const allocation = [
  { accountNumber: 3000, amountMinor: 29_950, departmentId: "16", vatCode: 3 },
  { accountNumber: 3100, amountMinor: 5, departmentId: "21", vatCode: 5 },
];

function reverse(overrides: Record<string, unknown> = {}) {
  return finagoRefundReverser.reverse({
    allocation,
    amount: 299.55,
    campusId: "1",
    db,
    orderId: "order-1",
    provider: "vipps",
    ...overrides,
  });
}

describe("finagoRefundReverser", () => {
  beforeEach(() => {
    for (const fn of [...Object.values(db), ...Object.values(mocks)]) {
      fn.mockReset();
    }
    db.getRow.mockResolvedValue(SETTINGS_ROW);
    mocks.buildShopReversalTransactionInput.mockReturnValue({ built: true });
    mocks.postLedgerTransaction.mockResolvedValue("finago-rev-1");
  });

  it("credits the clearing account of the order's provider", async () => {
    await reverse({ provider: "vipps" });
    await reverse({ provider: "stripe" });

    expect(mocks.buildShopReversalTransactionInput).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ clearingAccount: 1530 })
    );
    expect(mocks.buildShopReversalTransactionInput).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ clearingAccount: 1540 })
    );
  });

  it("converts each allocation entry from øre to NOK and reverses the refund amount", async () => {
    const transactionId = await reverse();

    expect(transactionId).toBe("finago-rev-1");
    expect(mocks.buildShopReversalTransactionInput).toHaveBeenCalledWith(
      expect.objectContaining({
        campusId: "1",
        comment: "Refusjon nettbutikk order-1",
        lines: [
          {
            accountNumber: 3000,
            amount: 299.5,
            departmentId: "16",
            vatCode: 3,
          },
          { accountNumber: 3100, amount: 0.05, departmentId: "21", vatCode: 5 },
        ],
        total: 299.55,
        transactionTypeNumber: 8,
      })
    );
    expect(mocks.postLedgerTransaction).toHaveBeenCalledWith({ built: true });
  });

  it("throws without posting when shop accounting settings are missing", async () => {
    db.getRow.mockRejectedValue(
      Object.assign(new Error("row_not_found"), { code: 404 })
    );

    await expect(reverse()).rejects.toThrow(
      "Shop accounting settings have not been saved in admin"
    );
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("throws without posting for an unknown payment provider", async () => {
    await expect(reverse({ provider: "klarna" })).rejects.toThrow(
      'No clearing account for payment provider "klarna"'
    );
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });

  it("posts nothing when there is nothing to reverse", async () => {
    expect(await reverse({ allocation: [] })).toBeNull();
    expect(mocks.postLedgerTransaction).not.toHaveBeenCalled();
  });
});
