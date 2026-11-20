import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type Expenses, ExpensesCheckState } from "@repo/api/types/appwrite";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";
import { incrementCheckClaim } from "@/lib/expense-check/claim";
import { noAgent, runExpenseCheck } from "@/lib/expense-check/run";
import { recordCheckStuckIssue } from "@/lib/expense-check/stuck-issue";

/**
 * Backstop for the reimbursement background check. If the instance dies after
 * the submit, a check stays `queued` or `running` and nobody is told; every
 * tick this takes over the ones that are stale, oldest first, at most 5, and
 * runs them side by side so each fits in the route's 300 s.
 *
 * Stale means 10 minutes since the check was started (`check_started_at`, for
 * `running`) or since the row last changed (`$updatedAt`, for `queued`). The
 * api's `maxDuration` is 300 s, so a live run is never taken over. A `queued`
 * row that already has `check_finished_at` is the racing-submit repair case;
 * its run notifies nobody.
 *
 * Taking over is one atomic increment of `check_claim`, passed to
 * `runExpenseCheck` as the claim, so a concurrent run or tick loses. A stale
 * `running` row whose claim is already 2 or more was taken over once before:
 * it runs fallback-only, without the AI agent.
 *
 * After three takeovers (a listed claim of 4) the backstop gives up: it
 * claims the row once more, which keeps it out of every later list, and
 * records one approval issue for IT. The third takeover's own failure
 * records that issue at once, with its error. Sends `x-cron-secret` from the
 * dispatcher, or `Authorization: Bearer ${CRON_SECRET}` by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const LOG_TAG = "[Expense Check Backstop]";
const STALE_AFTER_MS = 10 * 60_000;
const BATCH_SIZE = 5;
/** A claim at or above this on a stale `running` row means a takeover died. */
const TAKEN_OVER_CLAIM = 2;
/** A listed claim at or above this: three takeovers died, so it gives up. */
const GIVE_UP_CLAIM = 4;

function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

function hasValidCronSecret(request: Request, secret: string): boolean {
  return [readBearerToken(request), request.headers.get("x-cron-secret")].some(
    (candidate) => safeSecretCompare(candidate, secret)
  );
}

interface Counts {
  failed: number;
  fallbackOnly: number;
  found: number;
  /** Rows given up on after three takeovers, with an approval issue for IT. */
  gaveUp: number;
  ran: number;
  skipped: number;
}

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

/**
 * Gives this tick's claim back. Best-effort: if it fails, the check waits
 * for a later tick.
 */
async function undoClaim(db: Db, expenseId: string): Promise<void> {
  await db
    .decrementRowColumn({
      databaseId: "app",
      tableId: "expense",
      rowId: expenseId,
      column: "check_claim",
      value: 1,
      min: 0,
    })
    .catch((error: unknown) => {
      console.error(`${LOG_TAG} could not undo ${expenseId}'s claim:`, error);
    });
}

/**
 * The approval issue of a check given up on. When it can't be written, the
 * claim is given back, so the next tick lists the row and tries again.
 */
async function giveUp(db: Db, expenseId: string): Promise<void> {
  try {
    await recordCheckStuckIssue(db, expenseId);
  } catch (error) {
    await undoClaim(db, expenseId);
    throw error;
  }
}

async function takeOver(
  db: Db,
  expense: Expenses,
  counts: Counts
): Promise<void> {
  const claim = await incrementCheckClaim(db, expense.$id);
  // Exclusive takeover: only the tick whose increment came straight after the
  // value it listed owns the row. An overlapping tick (or a run that claimed
  // since) pushed the counter further, so this one steps aside and undoes its
  // increment, so the owner's run still sees its own claim.
  const listedClaim = expense.check_claim ?? 0;
  if (claim !== listedClaim + 1) {
    await undoClaim(db, expense.$id);
    counts.skipped += 1;
    return;
  }
  if (listedClaim >= GIVE_UP_CLAIM) {
    await giveUp(db, expense.$id);
    counts.gaveUp += 1;
    return;
  }
  const secondTime =
    expense.check_state === ExpensesCheckState.RUNNING &&
    listedClaim >= TAKEN_OVER_CLAIM;
  if (secondTime) {
    counts.fallbackOnly += 1;
  }
  let outcome: Awaited<ReturnType<typeof runExpenseCheck>>;
  try {
    outcome = await runExpenseCheck(
      expense.$id,
      secondTime ? { agent: noAgent, claim } : { claim }
    );
  } catch (error) {
    if (claim >= GIVE_UP_CLAIM) {
      // The third takeover failed as well: IT hears of it now, with the
      // error, and the next tick only claims the row out of the list.
      await recordCheckStuckIssue(db, expense.$id, error).catch(
        (cause: unknown) => {
          console.error(
            `${LOG_TAG} could not record ${expense.$id}'s issue:`,
            cause
          );
        }
      );
    }
    throw error;
  }
  if (outcome === "skipped") {
    counts.skipped += 1;
  } else {
    counts.ran += 1;
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(`${LOG_TAG} CRON_SECRET is not configured`);
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (!hasValidCronSecret(request, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { db } = await createAdminClient();
    const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
    const { rows } = await db.listRows<Expenses>("app", "expense", [
      Query.or([
        Query.and([
          Query.equal("check_state", ExpensesCheckState.QUEUED),
          Query.lessThan("$updatedAt", cutoff),
        ]),
        Query.and([
          Query.equal("check_state", ExpensesCheckState.RUNNING),
          Query.lessThan("check_started_at", cutoff),
        ]),
      ]),
      // Not a row it gave up on (claimed past 4). A null claim is an old
      // draft's, still to be checked.
      Query.or([
        Query.lessThanEqual("check_claim", GIVE_UP_CLAIM),
        Query.isNull("check_claim"),
      ]),
      // A running row's `$updatedAt` is its start write (the run's next
      // write is the last one), so it orders the same as the start time; a
      // queued row has only `$updatedAt`. One order covers both.
      Query.orderAsc("$updatedAt"),
      Query.limit(BATCH_SIZE),
    ]);

    const counts: Counts = {
      failed: 0,
      fallbackOnly: 0,
      found: rows.length,
      gaveUp: 0,
      ran: 0,
      skipped: 0,
    };
    // Side by side: each run gets the route's whole time, as a run in the
    // submit's `after()` would. One after another, the second run would be
    // cut off part-way and go fallback-only on the next takeover.
    const results = await Promise.allSettled(
      rows.map((expense) => takeOver(db, expense, counts))
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        counts.failed += 1;
        console.error(`${LOG_TAG} ${rows[index]?.$id} failed:`, result.reason);
      }
    }
    console.log(`${LOG_TAG} Done`, counts);
    return NextResponse.json(counts);
  } catch (error) {
    console.error(`${LOG_TAG} Backstop failed:`, error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
