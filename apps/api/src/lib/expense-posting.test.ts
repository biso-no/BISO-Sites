import { ExpenseApprovalsStatus } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertApprovedExpenseChain } from "./expense-approval-chain";

const db = {
  listRows: vi.fn(),
};

describe("assertApprovedExpenseChain", () => {
  beforeEach(() => {
    db.listRows.mockReset();
  });

  it("rejects approved expenses with no approval chain", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });

    await expect(
      assertApprovedExpenseChain(db as never, "expense-1")
    ).rejects.toThrow("has no approval chain");
  });

  it("rejects approved expenses when any approval is not approved", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        { $id: "approval-1", status: ExpenseApprovalsStatus.APPROVED, step: 1 },
        { $id: "approval-2", status: ExpenseApprovalsStatus.PENDING, step: 2 },
      ],
      total: 2,
    });

    await expect(
      assertApprovedExpenseChain(db as never, "expense-1")
    ).rejects.toThrow("not fully approved");
  });

  it("allows expenses when every approval-chain row is approved", async () => {
    db.listRows.mockResolvedValue({
      rows: [
        { $id: "approval-1", status: ExpenseApprovalsStatus.APPROVED, step: 1 },
        { $id: "approval-2", status: ExpenseApprovalsStatus.APPROVED, step: 2 },
      ],
      total: 2,
    });

    await expect(
      assertApprovedExpenseChain(db as never, "expense-1")
    ).resolves.toBeUndefined();
  });
});
