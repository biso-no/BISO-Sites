import { fastModel } from "@repo/ai/models";
import { appwriteErrorStatus } from "@repo/api/errors";
import { getFeatureFlagStates } from "@repo/shared/utils/feature-flags-server";
import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from "@/lib/auth";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import {
  buildExpenseSummaryPrompt,
  normalizeExpenseSummaryRequest,
} from "@/lib/expense-summary";

const HTTP_UNAUTHORIZED = 401;
const HTTP_INTERNAL_ERROR = 500;

const SummarySchema = z.object({
  summary: z
    .string()
    .describe("A concise general description summarizing all the expenses."),
});

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Auth check - supports both JWT (Authorization header) and session cookie
  // account.get() throws (Appwrite 401) for a missing/expired session; keep it
  // inside a try so the caller gets a JSON 401 with CORS, not an unhandled 500.
  try {
    const { account } = await createAuthenticatedClient(req);
    await account.get();
  } catch (error) {
    const unauthorized = appwriteErrorStatus(error) === HTTP_UNAUTHORIZED;
    if (!unauthorized) {
      console.error("[expenses/summary] Auth check failed:", error);
    }
    return applyCorsHeaders(
      NextResponse.json(
        {
          error: unauthorized ? "Unauthorized" : "Authentication check failed",
        },
        { status: unauthorized ? HTTP_UNAUTHORIZED : HTTP_INTERNAL_ERROR }
      ),
      origin
    );
  }

  // Kill switch: AI expense summarization is gated like OCR.
  const flags = await getFeatureFlagStates();
  if (!(flags.expenses_module && flags.expenses_ocr)) {
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Expense AI assistance is currently disabled" },
        { status: 403 }
      ),
      origin
    );
  }

  try {
    const summaryRequest = normalizeExpenseSummaryRequest(await req.json());

    if (!summaryRequest) {
      return applyCorsHeaders(
        NextResponse.json(
          { error: "Invalid expense summary payload" },
          { status: 400 }
        ),
        origin
      );
    }

    const { object } = await generateObject({
      model: fastModel,
      reasoning: "low",
      schema: SummarySchema,
      messages: [
        {
          role: "user",
          content: buildExpenseSummaryPrompt(summaryRequest),
        },
      ],
    });

    return applyCorsHeaders(
      NextResponse.json({ success: true, summary: object.summary }),
      origin
    );
  } catch (error) {
    console.error("Summary Generation Error:", error);
    return applyCorsHeaders(
      NextResponse.json(
        { error: "Failed to generate summary" },
        { status: 500 }
      ),
      origin
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
