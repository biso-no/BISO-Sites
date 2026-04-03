/**
 * Text-based AI assistant route
 *
 * Handles non-canvas operations: copy generation, grammar check,
 * improvement suggestions, and translation. Returns a plain streaming
 * text response consumed by the AI assistant plugin panel.
 */

import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import type { AssistAction } from "@repo/editor/contexts/ai-assistant-context";

const SYSTEM_PROMPTS: Record<AssistAction, string> = {
  headline:
    "You are a concise copywriter. Generate a single headline (max 10 words) for the topic provided by the user. Output ONLY the headline — no quotes, no explanation, no punctuation at the end unless it is a question.",

  description:
    "You are a copywriter. Write one engaging paragraph (2–4 sentences) that describes the topic provided. Output ONLY the paragraph — no preamble, no labels.",

  cta: "You are a UX copywriter. Generate compelling call-to-action button text: 2–5 words that clearly state the action. Output ONLY the button text — no quotes, no explanation.",

  grammar:
    "You are a copy editor. Review the provided text for grammar, spelling, and punctuation errors. List each issue as:\n  [original phrase] → [corrected phrase]\nIf there are no issues, respond with exactly: No issues found.",

  suggest:
    "You are a web content strategist. Given a page structure summary, suggest 3–5 specific and actionable improvements to make the page more effective. Format as a numbered list. Be direct — no preamble.",

  "translate-en":
    "You are a professional Norwegian→English translator. Translate the provided Norwegian text to natural, fluent English. Preserve the original tone, formatting, and meaning. Output ONLY the translation — no preamble.",

  "translate-no":
    "You are a professional English→Norwegian translator (Bokmål). Translate the provided English text to natural, fluent Norwegian Bokmål. Preserve the original tone, formatting, and meaning. Output ONLY the translation — no preamble.",
};

export async function POST(req: Request) {
  try {
    const { action, content } = (await req.json()) as {
      action: AssistAction;
      content: string;
    };

    if (!action || !content?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing action or content" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const system = SYSTEM_PROMPTS[action];
    if (!system) {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = streamText({
      // gpt-5-mini is faster and cheaper for text-only ops
      model: openai("gpt-5-mini"),
      system,
      prompt: content,
    });

    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[assist] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
