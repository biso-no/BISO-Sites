import { expect, test } from "bun:test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import {
  isStepCount,
  readUIMessageStream,
  streamText,
  toUIMessageStream,
} from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { pageEditorTools } from "./index";

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

/**
 * A model that behaves the way the copilot prompt asks for: a short preamble,
 * then a tool call, then a closing summary once the tool result comes back.
 */
function narratingModel() {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: () => {
      call += 1;
      if (call === 1) {
        return Promise.resolve({
          stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "t0" },
            {
              type: "text-delta",
              id: "t0",
              delta: "Sure — I'll add a hero at the top.",
            },
            { type: "text-end", id: "t0" },
            { type: "tool-input-start", id: "c1", toolName: "insert_block" },
            { type: "tool-input-delta", id: "c1", delta: '{"type":"hero"}' },
            { type: "tool-input-end", id: "c1" },
            {
              type: "tool-call",
              toolCallId: "c1",
              toolName: "insert_block",
              input: '{"type":"hero"}',
            },
            {
              type: "finish",
              finishReason: { unified: "tool-calls", raw: "tool_calls" },
              usage: USAGE,
            },
          ]),
        });
      }
      return Promise.resolve({
        stream: convertArrayToReadableStream<LanguageModelV4StreamPart>([
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t1" },
          {
            type: "text-delta",
            id: "t1",
            delta: "Added a hero at the top. Want me to write the headline?",
          },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: USAGE,
          },
        ]),
      });
    },
  });
}

async function runCopilotTurn() {
  const result = streamText({
    model: narratingModel(),
    instructions: "test",
    prompt: "Add a hero",
    tools: pageEditorTools,
    stopWhen: isStepCount(12),
  });

  const stream = toUIMessageStream({
    stream: result.stream,
    tools: pageEditorTools,
  });

  let final: { parts: Array<Record<string, unknown>> } | undefined;
  for await (const message of readUIMessageStream({ stream })) {
    final = message as typeof final;
  }
  return final?.parts ?? [];
}

test("the copilot's preamble reaches the client before the tool call", async () => {
  const parts = await runCopilotTurn();

  // The panel only renders text and tool-* parts, in array order.
  const rendered = parts
    .filter(
      (part) =>
        part.type === "text" || (part.type as string).startsWith("tool-")
    )
    .map((part) => (part.type === "text" ? "text" : "tool"));

  expect(rendered).toEqual(["text", "tool", "text"]);
});

test("page editor tools are executable by streamText", async () => {
  const parts = await runCopilotTurn();

  const toolPart = parts.find((part) =>
    (part.type as string).startsWith("tool-")
  );

  // Guards the tool definitions: a tool declared with the pre-v5 `parameters`
  // key streams as `input-available` and never runs.
  expect(toolPart?.type).toBe("tool-insert_block");
  expect(toolPart?.state).toBe("output-available");
});
