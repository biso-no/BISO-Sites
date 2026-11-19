import { balancedModel } from "@repo/ai/models";
import { buildSystemPrompt, pageEditorTools } from "@repo/editor/ai";
import { traceAiStream } from "@repo/observability/ai";
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

  const modelMessages = await convertToModelMessages(messages);
  const result = traceAiStream(
    {
      functionId: "admin.page-editor-chat",
      model: balancedModel,
      operation: "chat",
      signal: request.signal,
    },
    (span) =>
      streamText({
        model: balancedModel,
        instructions: buildSystemPrompt(
          pageContext ?? "(no page context provided)"
        ),
        messages: modelMessages,
        tools: pageEditorTools,
        // Headroom for: preamble + edits -> a state check -> more edits -> the
        // closing summary. The loop ends naturally on the first step with no
        // tool calls, so this is only a runaway guard. At 5 a multi-block
        // build hit the cap on a tool step and the user never got the summary.
        stopWhen: isStepCount(12),
        onEnd: span.onEnd,
        // In place of the AI SDK's own handler, which logs the whole error.
        onError: span.onErrorWithLog,
      })
  );

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: pageEditorTools,
    }),
  });
}
