// Server-to-server: the admin app changes the approver of the current step.
// Saves the choice in the approver directory and sends the new approver a link.

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { changeStepApprover } from "@/lib/expense-approval";
import { isInternalRequest } from "@/lib/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;
const MAX_APPROVAL_ID = 64;
const MAX_EMAIL = 320;
const MAX_NAME = 256;

const BodySchema = z.object({
  approvalId: z.string().min(1).max(MAX_APPROVAL_ID),
  email: z.email().max(MAX_EMAIL),
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

  try {
    const result = await changeStepApprover(parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: HTTP_BAD_REQUEST }
      );
    }
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[expenses/admin/change-approver] Change failed:", error);
    return NextResponse.json(
      { error: "Could not change the approver" },
      { status: HTTP_INTERNAL_ERROR }
    );
  }
}
