// Bot Framework messaging endpoint. Handles Adaptive Card Action.Execute invokes
// (Approve / Reject) from the Teams approval card, records the decision, and
// returns a replacement card.

import {
  authenticateBotRequest,
  buildDecisionResultCard,
} from "@repo/connectors/teams-bot";
import type { Activity } from "botbuilder";
import { type NextRequest, NextResponse } from "next/server";
import { decideApproval } from "@/lib/expense-approval";

interface CardAction {
  data?: { token?: string };
  verb?: string;
}

function adaptiveCardResponse(card: Record<string, unknown>) {
  return NextResponse.json({
    statusCode: 200,
    type: "application/vnd.microsoft.card.adaptive",
    value: card,
  });
}

function messageResponse(text: string) {
  return NextResponse.json({
    statusCode: 200,
    type: "application/vnd.microsoft.activity.message",
    value: text,
  });
}

export async function POST(req: NextRequest) {
  const activity = (await req.json()) as Activity;
  const authHeader = req.headers.get("authorization") ?? "";

  try {
    await authenticateBotRequest(activity, authHeader);
  } catch (error) {
    console.error("[teams/bot] auth failed:", error);
    return new NextResponse("Unauthorized", { status: 401 });
  }

  if (activity.type !== "invoke" || activity.name !== "adaptiveCard/action") {
    return new NextResponse(null, { status: 200 });
  }

  const value = activity.value as { action?: CardAction } | undefined;
  const action = value?.action;
  const token = action?.data?.token;
  const decision = action?.verb === "approve" ? "approved" : "rejected";

  if (!token) {
    return messageResponse("This approval action is missing its token.");
  }

  const decidedBy =
    activity.from?.name ?? activity.from?.aadObjectId ?? "Teams user";

  const result = await decideApproval({
    rawToken: token,
    decision,
    decidedBy,
  });

  if (!result.ok) {
    return messageResponse(result.error);
  }

  return adaptiveCardResponse(
    buildDecisionResultCard({
      decision: result.decision,
      decidedBy,
      reimbursementNumber: result.reimbursementNumber,
    })
  );
}
