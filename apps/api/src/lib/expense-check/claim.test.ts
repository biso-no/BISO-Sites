import { describe, expect, it, vi } from "vitest";
import { incrementCheckClaim } from "./claim";

/**
 * An expense row whose `check_claim` the increment treats as Appwrite might
 * treat a column saved as null: `nullAnswer` says how, refused or answered
 * without a number.
 */
function claimDb(
  checkClaim: number | null,
  nullAnswer: "rejects" | "no-number" = "rejects"
) {
  const row: { $id: string; check_claim: number | null } = {
    $id: "expense-1",
    check_claim: checkClaim,
  };
  const db = {
    getRow: vi.fn(async () => ({ ...row })),
    incrementRowColumn: vi.fn(({ value }: { value: number }) => {
      if (row.check_claim === null) {
        return nullAnswer === "rejects"
          ? Promise.reject(new Error("Attribute check_claim is null"))
          : Promise.resolve({ $id: row.$id, check_claim: null });
      }
      row.check_claim += value;
      return Promise.resolve({ ...row });
    }),
    updateRow: vi.fn(
      (
        _database: string,
        _table: string,
        _id: string,
        data: { check_claim: number }
      ) => {
        row.check_claim = data.check_claim;
        return Promise.resolve({ ...row });
      }
    ),
  };
  return { db, row };
}

describe("incrementCheckClaim", () => {
  it("is one atomic increment when the column holds a number", async () => {
    const { db } = claimDb(0);

    expect(await incrementCheckClaim(db as never, "expense-1")).toBe(1);
    expect(db.incrementRowColumn).toHaveBeenCalledTimes(1);
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("a claim saved as null on an old draft is set to 0, then claimed", async () => {
    for (const answer of ["rejects", "no-number"] as const) {
      const { db, row } = claimDb(null, answer);

      expect(await incrementCheckClaim(db as never, "expense-1")).toBe(1);
      expect(db.updateRow).toHaveBeenCalledWith("app", "expense", "expense-1", {
        check_claim: 0,
      });
      expect(db.incrementRowColumn).toHaveBeenCalledTimes(2);
      expect(row.check_claim).toBe(1);
    }
  });

  it("another failure is thrown, and nothing is written", async () => {
    const { db } = claimDb(3);
    db.incrementRowColumn.mockRejectedValueOnce(new Error("db down"));

    await expect(incrementCheckClaim(db as never, "expense-1")).rejects.toThrow(
      "db down"
    );
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
