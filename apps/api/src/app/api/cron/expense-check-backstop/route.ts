import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type Expenses, ExpensesCheckState } from "@repo/api/types/appwrite";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { NextResponse } from "next/server";
import { noAgent, runExpenseCheck } from "@/lib/expense-check/run";

/**
 * Backstop for the reimbursement background check. If the instance dies after
 * the submit, a check stays `queued` or `running` and nobody is told; every
 * tick this takes over the ones that are stale, oldest first, at most 5.
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
 * it runs fallback-only, without the AI agent. Sends `x-cron-secret` from the
 * dispatcher, or `Authorization: Bearer ${CRON_SECRET}` by hand.
 */

export const runtime = "nodejs";
export const maxDuration = 300;

const LOG_TAG = "[Expense Check Backstop]";
const STALE_AFTER_MS = 10 * 60_000;
const BATCH_SIZE = 5;
/** A claim at or above this on a stale `running` row means a takeover died. */
const TAKEN_OVER_CLAIM = 2;

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
  ran: number;
  skipped: number;
}

async function takeOver(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  expense: Expenses,
  counts: Counts
): Promise<void> {
  const claimed = await db.incrementRowColumn<Expenses>({
    databaseId: "app",
    tableId: "expense",
    rowId: expense.$id,
    column: "check_claim",
    value: 1,
  });
  const claim = claimed.check_claim;
  // Exclusive takeover: only the tick whose increment came straight after the
  // value it listed owns the row. An overlapping tick (or a run that claimed
  // since) pushed the counter further, so this one steps aside.
  const listedClaim = expense.check_claim ?? 0;
  if (claim !== listedClaim + 1) {
    counts.skipped += 1;
    return;
  }
  const secondTime =
    expense.check_state === ExpensesCheckState.RUNNING &&
    listedClaim >= TAKEN_OVER_CLAIM;
  if (secondTime) {
    counts.fallbackOnly += 1;
  }
  const outcome = await runExpenseCheck(
    expense.$id,
    secondTime ? { agent: noAgent, claim } : { claim }
  );
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
      ran: 0,
      skipped: 0,
    };
    for (const expense of rows) {
      try {
        await takeOver(db, expense, counts);
      } catch (error) {
        counts.failed += 1;
        console.error(`${LOG_TAG} ${expense.$id} failed:`, error);
      }
    }
    console.log(`${LOG_TAG} Done`, counts);
    return NextResponse.json(counts);
  } catch (error) {
    console.error(`${LOG_TAG} Backstop failed:`, error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
