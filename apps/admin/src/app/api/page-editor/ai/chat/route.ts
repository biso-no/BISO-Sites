import { createAnthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { pageEditorTools } from "@repo/editor/ai";
import { buildSystemPrompt } from "@repo/editor/ai";

export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  const body = await request.json();
  const { messages, pageContext } = body as {
    messages: unknown[];
    pageContext?: string;
  };

  if (!messages || !Array.isArray(messages)) {
    return new Response("Bad request: missing messages", { status: 400 });
  }

  const modelMessages = await convertToModelMessages(messages as never[]);

  const result = streamText({
    model: anthropic("claude-opus-4-7"),
    system: buildSystemPrompt(pageContext ?? "(no page context provided)"),
    messages: modelMessages,
    tools: pageEditorTools as never,
    stopWhen: stepCountIs(5) as never,
  });

  return result.toUIMessageStreamResponse();
}
