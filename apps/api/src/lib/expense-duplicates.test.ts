import { Query } from "@repo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findPossibleDuplicate } from "./expense-duplicates";

const listRows = vi.fn();
const getRow = vi.fn();
const db = { getRow, listRows } as never;

const expenses: Record<string, { $sequence: number | string; status: string }> =
  {
    draft1: { $sequence: 5, status: "draft" },
    rejected1: { $sequence: 6, status: "rejected" },
    sent1: { $sequence: "42", status: "pending" },
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
    expect(queries).toContain("greaterThanEqual");
    expect(queries).toContain("lessThan");
    expect(queries).not.toContain('between("date"');
    expect(queries).toContain("99.49");
    expect(queries).toContain("99.51");
  });

  it("queries the Oslo day as start-inclusive, end-exclusive", async () => {
    listRows.mockResolvedValue({ rows: [] });

    await findPossibleDuplicate(db, {
      amount: 10,
      date: "2026-11-01",
      fileHash: null,
    });

    const queries = listRows.mock.calls[0][2].map(String);
    expect(queries).toContain(
      Query.greaterThanEqual("date", "2026-10-31T23:00:00.000Z")
    );
    expect(queries).toContain(
      Query.lessThan("date", "2026-11-01T23:00:00.000Z")
    );
  });

  it("does not date-match a zero or missing amount", async () => {
    for (const amount of [0, null, -5]) {
      await expect(
        findPossibleDuplicate(db, {
          amount,
          date: "2026-11-01",
          fileHash: null,
        })
      ).resolves.toBeNull();
    }
    expect(listRows).not.toHaveBeenCalled();
  });

  it("keeps going when a candidate expense is gone", async () => {
    listRows.mockResolvedValueOnce({
      rows: [{ expense_id: "gone" }, { expense_id: "sent1" }],
    });
    getRow.mockImplementation((_d: string, _t: string, id: string) =>
      id === "gone"
        ? Promise.reject(new Error("404"))
        : Promise.resolve({ $id: id, ...expenses[id] })
    );

    const result = await findPossibleDuplicate(db, {
      amount: null,
      date: null,
      fileHash: "abc",
    });

    expect(result?.expenseId).toBe("sent1");
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
