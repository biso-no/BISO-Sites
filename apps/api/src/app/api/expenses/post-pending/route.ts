// CRON-gated poster: posts approved reimbursements to the 24SevenOffice ledger.
// Idempotent and batched; decoupled from the Teams invoke (which has a ~15s
// timeout) so the slow upload/post happens here. Driven by the scheduled-dispatch
// Appwrite Function via the shared CRON_SECRET (x-cron-secret header).

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { type Expenses, ExpensesStatus } from "@repo/api/types/appwrite";
import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { safeSecretCompare } from "@repo/shared/utils/secrets";
import { type NextRequest, NextResponse } from "next/server";
import { postApprovedExpense } from "@/lib/expense-posting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 5;

function readBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

// Header-only secret check (Bearer or x-cron-secret), mirroring the other
// scheduled api endpoints so the same CRON_SECRET works everywhere.
function hasValidCronSecret(request: NextRequest, secret: string): boolean {
  const candidates = [
    readBearerToken(request),
    request.headers.get("x-cron-secret"),
  ];
  return candidates.some((candidate) => safeSecretCompare(candidate, secret));
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!hasValidCronSecret(req, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Honor the same kill switch as the submit path: when ledger posting is off,
  // don't post already-approved expenses to 24SO. Reported as a healthy no-op.
  if (!(await isFeatureEnabled("expenses_ledger_posting"))) {
    return NextResponse.json({
      success: true,
      skipped: true,
      reason: "expenses_ledger_posting disabled",
    });
  }

  const { db } = await createAdminClient();
  const pending = await db.listRows<Expenses>("app", "expense", [
    Query.equal("status", ExpensesStatus.APPROVED),
    Query.limit(BATCH_SIZE),
  ]);

  let posted = 0;
  let failed = 0;
  for (const expense of pending.rows) {
    try {
      await postApprovedExpense(expense.$id);
      posted += 1;
    } catch {
      failed += 1;
    }
  }

  // Surface posting failures to the scheduler, which classifies target health by
  // response.ok — a 200 would report a failed ledger run as a successful ping.
  return NextResponse.json(
    {
      success: failed === 0,
      considered: pending.rows.length,
      posted,
      failed,
    },
    { status: failed > 0 ? 500 : 200 }
  );
}
