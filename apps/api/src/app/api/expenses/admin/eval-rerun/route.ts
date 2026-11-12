// Server-to-server: the admin AI tab re-classifies recent booked receipts with
// today's types and prompt and reports how often the booked type comes back.
// Runs only when the AI is on, like the classification itself.

import { createAdminClient } from "@repo/api/server";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runRerunCheck } from "@/lib/expense-eval";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// The check has its own two minute budget, plus the calls still running.
export const maxDuration = 300;

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_INTERNAL_ERROR = 500;
const MAX_LIMIT = 200;

const BodySchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).optional(),
});

export async function POST(req: NextRequest) {
  if (!isInternalRequest(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_UNAUTHORIZED }
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "invalid_body",
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      },
      { status: HTTP_BAD_REQUEST }
    );
  }

  const flags = await getFeatureFlagStates();
  if (!(flags.expenses_module && flags.expenses_ocr)) {
    return NextResponse.json(
      { code: "ai_disabled", error: "The AI is switched off" },
      { status: HTTP_CONFLICT }
    );
  }

  try {
    const { db } = await createAdminClient();
    const result = await runRerunCheck(db, parsed.data);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[expenses/admin/eval-rerun] Check failed:", error);
    return NextResponse.json(
      { error: "Could not run the check" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
