// Public, token-gated expense approval endpoints used by the web approval page
// (the Outlook email link target). GET returns the approval context; POST
// records the decision (shared decideApproval logic — same as the Teams bot).

import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { decideApproval, getApprovalContext } from "@/lib/expense-approval";

export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return applyCorsHeaders(
      NextResponse.json({ error: "Missing token" }, { status: 400 }),
      origin
    );
  }

  const context = await getApprovalContext(token);
  if (!context) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "This approval link is invalid." },
        { status: 404 }
      ),
      origin
    );
  }

  return applyCorsHeaders(NextResponse.json({ context }), origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const body = (await req.json()) as {
    token?: string;
    decision?: "approved" | "rejected";
    reason?: string;
    decidedBy?: string;
  };

  if (!(body.token && body.decision)) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Missing token or decision" },
        { status: 400 }
      ),
      origin
    );
  }

  const result = await decideApproval({
    rawToken: body.token,
    decision: body.decision,
    decidedBy: body.decidedBy || "Web approver",
    reason: body.reason,
  });

  if (!result.ok) {
    return applyCorsHeaders(
      NextResponse.json({ error: result.error }, { status: 400 }),
      origin
    );
  }

  return applyCorsHeaders(NextResponse.json({ success: true, result }), origin);
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
