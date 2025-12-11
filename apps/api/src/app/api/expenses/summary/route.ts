import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from "@/lib/auth";

const SummarySchema = z.object({
  summary: z
    .string()
    .describe("A concise general description summarizing all the expenses."),
});

export async function POST(req: NextRequest) {
  // Auth check - supports both JWT (Authorization header) and session cookie
  const { account } = await createAuthenticatedClient(req);
  const user = await account.get();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { descriptions } = await req.json();

    if (
      !descriptions ||
      !Array.isArray(descriptions) ||
      descriptions.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid descriptions provided" },
        { status: 400 }
      );
    }

    const { object } = await generateObject({
      model: openai("gpt-5-nano"),
      schema: SummarySchema,
      messages: [
        {
          role: "user",
          content: `Create a short, general summary (max 1 sentence) for an expense report that includes the following items:
${descriptions.map((d) => `- ${d}`).join("\n")}

The summary will be used by the accounting team to get a quick overview.
Examples:
- "Lunch and dinner for client meeting"
- "Office supplies and electronics"
- "Travel expenses to Berlin including flight and hotel"`,
        },
      ],
    });

    return NextResponse.json({ success: true, summary: object.summary });
  } catch (error) {
    console.error("Summary Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
