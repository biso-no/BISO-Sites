/**
 * AI Editor Command Route
 *
 * Powers the AI action menu (Mod+J) in the PlateJS ContentEditor.
 * Handles: generate, improve, shorten, expand, summarize, translate, comment.
 *
 * Expected request body (AI SDK v5 UIMessage format):
 *   { messages: UIMessage[], system?: string, data?: { contentType?: string } }
 */

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

const BASE_SYSTEM = `You are an expert writing assistant embedded in a content management system.
You help content editors write, improve, and refine content.
Always respond in the same language as the user's input unless explicitly asked to translate.
Be concise and direct — editors are professionals, not students.`;

const CONTENT_TYPE_CONTEXT: Record<string, string> = {
  events:
    "The content is for an event listing (conference, workshop, social gathering, etc.). Use an engaging, informative tone. Focus on what attendees will gain.",
  news: "The content is a news article or announcement. Use a professional journalistic tone. Lead with the most important information.",
  jobs: "The content is a job posting. Be clear about responsibilities and requirements. Use a welcoming but professional tone.",
  products:
    "The content is a product description for a webshop. Highlight benefits over features. Use persuasive but honest language.",
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, system, data } = body as {
      messages: UIMessage[];
      system?: string;
      data?: { contentType?: string };
    };

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build context-aware system prompt
    const contentTypeCtx = data?.contentType
      ? `\n\n${CONTENT_TYPE_CONTEXT[data.contentType] ?? ""}`
      : "";
    const systemPrompt = system
      ? `${system}${contentTypeCtx}`
      : `${BASE_SYSTEM}${contentTypeCtx}`;

    const result = streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      // UIMessage[] → ModelMessage[] (AI SDK v5 requirement)
      messages: convertToModelMessages(messages),
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[ai/command] Error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
