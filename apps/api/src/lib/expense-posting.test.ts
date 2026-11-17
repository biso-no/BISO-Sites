import { ExpenseApprovalsStatus } from "@repo/api/types/appwrite";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdf/expense-pdf", () => ({ generateExpensePdf: vi.fn() }));

import { assertApprovedExpenseChain } from "./expense-approval-chain";
import { teachesType } from "./expense-posting";

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

describe("teachesType", () => {
  const att = (over: Record<string, unknown>) =>
    ({
      ai_confidence: null,
      ai_cost_type: null,
      cost_type: "social",
      type_source: "student",
      ...over,
    }) as never;

  it("teaches the AI's and the student's own choices", () => {
    expect(teachesType(att({ type_source: "ai" }))).toBe(true);
    expect(teachesType(att({ type_source: "student" }))).toBe(true);
  });

  it("never teaches a server default", () => {
    expect(teachesType(att({ type_source: null }))).toBe(false);
  });

  it("teaches a legacy app type only when it matches a confident AI type", () => {
    const legacy = { type_source: "legacy_app" };
    expect(
      teachesType(
        att({ ...legacy, ai_cost_type: "social", ai_confidence: 0.8 })
      )
    ).toBe(true);
    expect(
      teachesType(
        att({ ...legacy, ai_cost_type: "social", ai_confidence: 0.7 })
      )
    ).toBe(false);
    expect(
      teachesType(att({ ...legacy, ai_cost_type: "other", ai_confidence: 0.9 }))
    ).toBe(false);
  });
});
