// Server-to-server: the admin app rebuilds the approval chain of a pending
// expense that has no steps.

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rebuildApprovalChain } from "@/lib/expense-approval";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
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
      {
        code: "invalid_body",
        error: parsed.error.issues[0]?.message ?? "Invalid request",
      },
      { status: HTTP_BAD_REQUEST }
    );
  }

  try {
    const result = await rebuildApprovalChain(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { code: result.code, error: result.error },
        {
          status:
            result.code === "failed" ? HTTP_INTERNAL_ERROR : HTTP_BAD_REQUEST,
        }
      );
    }
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[expenses/admin/rebuild-chain] Rebuild failed:", error);
    return NextResponse.json(
      { error: "Could not rebuild the approval chain" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
