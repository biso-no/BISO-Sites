// The check's claim on an expense: one atomic increment of `check_claim`,
// shared by the run and the backstop, so only one of them checks it.

import { Query } from "@repo/api";
import type { createAdminClient } from "@repo/api/server";
import type { Expenses } from "@repo/api/types/appwrite";

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

function increment(db: Db, expenseId: string) {
  return db.incrementRowColumn<Expenses>({
    databaseId: "app",
    tableId: "expense",
    rowId: expenseId,
    column: "check_claim",
    value: 1,
  });
}

/**
 * Adds one to `check_claim` and returns the new value. No `max` bound: a lost
 * race shows in the value, not as an error.
 *
 * A draft saved before the column was pushed may still hold null, which the
 * increment can refuse or answer without a number. The column is then read
 * again and, only if it is still null, set to 0 and incremented once more.
 * Any other failure (an outage) is thrown as it is.
 */
export async function incrementCheckClaim(
  db: Db,
  expenseId: string
): Promise<number> {
  let failure: unknown = null;
  try {
    const { check_claim: claim } = await increment(db, expenseId);
    if (typeof claim === "number") {
      return claim;
    }
  } catch (error) {
    failure = error;
  }
  const { check_claim: stored } = await db.getRow<Expenses>(
    "app",
    "expense",
    expenseId,
    [Query.select(["$id", "check_claim"])]
  );
  if (stored !== null && stored !== undefined) {
    throw (
      failure ??
      new Error(`[expense-check] ${expenseId}'s claim could not be read`)
    );
  }
  await db.updateRow("app", "expense", expenseId, { check_claim: 0 });
  const { check_claim: claim } = await increment(db, expenseId);
  if (typeof claim !== "number") {
    throw new Error(`[expense-check] ${expenseId}'s claim could not be read`);
  }
  return claim;
}
