import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPossibleDuplicate } from "./expense-duplicates";

const listRows = vi.fn();
const getRow = vi.fn();
const db = { getRow, listRows } as never;

const expenses: Record<string, { $sequence: number; status: string }> = {
  draft1: { $sequence: 5, status: "draft" },
  rejected1: { $sequence: 6, status: "rejected" },
  sent1: { $sequence: 42, status: "pending" },
};

beforeEach(() => {
  listRows.mockReset();
  getRow.mockReset();
  getRow.mockImplementation(async (_d: string, _t: string, id: string) => ({
    $id: id,
    ...expenses[id],
  }));
});

describe("findPossibleDuplicate", () => {
  it("matches the same file in a submitted expense", async () => {
    listRows.mockResolvedValue({ rows: [{ expense_id: "sent1" }] });

    const result = await findPossibleDuplicate(db, {
      amount: 100,
      date: "2026-11-01",
      fileHash: "abc",
    });

    expect(result).toEqual({
      expenseId: "sent1",
      match: "file",
      reimbursementNumber: "10042",
    });
    expect(listRows).toHaveBeenCalledTimes(1);
  });

  it("ignores drafts, rejected and the excluded expense", async () => {
    listRows.mockResolvedValue({
      rows: [
        { expense_id: "draft1" },
        { expense_id: "rejected1" },
        { expense_id: null },
        { expense_id: "sent1" },
      ],
    });

    await expect(
      findPossibleDuplicate(db, {
        amount: null,
        date: null,
        excludeExpenseId: "sent1",
        fileHash: "abc",
      })
    ).resolves.toBeNull();
  });

  it("falls back to same day and amount", async () => {
    listRows
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ expense_id: "sent1" }] });

    const result = await findPossibleDuplicate(db, {
      amount: 99.5,
      date: "2026-11-01",
      fileHash: "abc",
    });

    expect(result?.match).toBe("date_amount");
    const queries = listRows.mock.calls[1][2].map(String).join(" ");
    expect(queries).toContain("2026-10-31T23:00:00.000Z");
    expect(queries).toContain("2026-11-01T23:00:00.000Z");
    expect(queries).toContain("99.49");
    expect(queries).toContain("99.51");
  });

  it("skips matching when there is nothing to match on", async () => {
    await expect(
      findPossibleDuplicate(db, { amount: null, date: null, fileHash: null })
    ).resolves.toBeNull();
    expect(listRows).not.toHaveBeenCalled();
  });

  it("returns null on db error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listRows.mockRejectedValue(new Error("down"));

    await expect(
      findPossibleDuplicate(db, {
        amount: 1,
        date: "2026-11-01",
        fileHash: "abc",
      })
    ).resolves.toBeNull();
    spy.mockRestore();
  });
});
