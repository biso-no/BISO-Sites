import { balancedModel } from "@repo/ai/models";
import { buildSystemPrompt, pageEditorTools } from "@repo/editor/ai";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { requireApiAuth } from "@/lib/api-auth";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  const { messages, pageContext } = body as {
    messages: UIMessage[];
    pageContext?: string;
  };

  if (!(messages && Array.isArray(messages))) {
    return new Response("Bad request: missing messages", { status: 400 });
  }

  const result = streamText({
    model: balancedModel,
    instructions: buildSystemPrompt(
      pageContext ?? "(no page context provided)"
    ),
    messages: await convertToModelMessages(messages),
    tools: pageEditorTools,
    // Headroom for: preamble + edits -> a state check -> more edits -> the
    // closing summary. The loop ends naturally on the first step with no tool
    // calls, so this is only a runaway guard. At 5 a multi-block build hit the
    // cap on a tool step and the user never got the summary.
    stopWhen: isStepCount(12),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: pageEditorTools,
    }),
  });
}
