// Server-to-server: the admin app retries the ledger booking of a failed
// expense. Gated by the same feature flag as the scheduled posting.

import { isFeatureEnabled } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { retryExpenseBooking } from "@/lib/expense-posting";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Posting runs inside the request, as in the scheduled route.
export const maxDuration = 300;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;
const MAX_EXPENSE_ID = 64;
const MAX_EMAIL = 320;
const MAX_NAME = 256;

const BodySchema = z.object({
  expenseId: z.string().min(1).max(MAX_EXPENSE_ID),
  actor: z.object({
    email: z.email().max(MAX_EMAIL).nullable(),
    name: z.string().min(1).max(MAX_NAME),
    kind: z.enum(["approver", "admin"]),
  }),
});

export async function POST(req: NextRequest) {
  if (!isInternalRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_UNAUTHORIZED }
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: HTTP_BAD_REQUEST }
    );
  }

  if (!(await isFeatureEnabled("expenses_ledger_posting"))) {
    return NextResponse.json(
      { error: "expenses_ledger_posting disabled" },
      { status: HTTP_CONFLICT }
    );
  }

  try {
    const result = await retryExpenseBooking(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: HTTP_BAD_REQUEST }
      );
    }
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[expenses/admin/retry-booking] Retry failed:", error);
    return NextResponse.json(
      { error: "Could not retry the booking" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
