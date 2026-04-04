/**
 * AI Copilot Ghost Text Route
 *
 * Provides inline autocomplete suggestions for the PlateJS editor.
 * The CopilotPlugin sends the current paragraph as context and expects
 * a short text completion ending with punctuation.
 *
 * Expected request body:
 *   { prompt: string, system?: string }
 */

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are an advanced AI writing assistant, similar to GitHub Copilot but for general prose.
Your task is to predict and generate the next part of the text based on the given context.

Rules:
- Continue the text naturally up to the next punctuation mark (., ,, ;, :, ?, or !).
- Maintain the existing style, tone, and voice. Never repeat given text.
- For unclear context, provide the most likely continuation.
- Handle lists, structured content, and technical writing if needed.
- CRITICAL: Always end your response with a punctuation mark.
- CRITICAL: Do not start a new block. Avoid block formatting like >, #, 1., 2., -, etc.
- CRITICAL: Keep the suggestion short — one clause or sentence at most.
- If you cannot generate a meaningful continuation, respond with exactly: 0`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, system } = body as { prompt: string; system?: string };

    if (!prompt?.trim()) {
      return new Response(JSON.stringify({ error: "No prompt provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = streamText({
      model: openai("gpt-5-nano"),
      system: system ?? SYSTEM_PROMPT,
      prompt,
      temperature: 0.4,
      // Stop at sentence boundaries to keep suggestions tight
      stopSequences: [".\n", "!\n", "?\n"],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("[ai/copilot] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
