// Server-to-server resend for a stranded approval step. The IT remediation queue
// calls this (with CRON_SECRET) when a next-step approval notification failed to
// deliver, so the chain is recovered with a fresh token. Gated by the same
// CRON_SECRET as the other scheduled endpoints.

import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { resendApprovalNotification } from "@/lib/expense-approval";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }
  if (!isInternalRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isFeatureEnabled("expenses_ledger_posting"))) {
    return NextResponse.json(
      { error: "expenses_ledger_posting disabled" },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    expenseId?: string;
  } | null;
  const expenseId = body?.expenseId;
  if (!expenseId) {
    return NextResponse.json(
      { error: "expenseId is required" },
      { status: 400 }
    );
  }

  try {
    const result = await resendApprovalNotification(expenseId);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Resend failed" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resend failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
