import { describe, expect, test } from "bun:test";
import {
  convertToModelMessages,
  isStepCount,
  type ModelMessage,
  readUIMessageStream,
  streamText,
  type ToolSet,
  tool,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { convertArrayToReadableStream, MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { buildAssistantCapabilities } from "../authz";
import type { AssistantActionDeps } from "../types";
import { clientTools } from "./client-tools";
import {
  CONFIRMATION_TTL_MS,
  type ConfirmationGate,
  createConfirmationGate,
  needsConfirmation,
  READ_ONLY_TOOL_NAMES,
} from "./confirmation";
import { buildAssistantTools } from "./index";

const SECRET = "test-only-secret";
const T0 = 1_800_000_000_000;

const GLOBAL_ADMIN = buildAssistantCapabilities({
  hasDepartmentMembership: false,
  isCampusAdmin: false,
  roles: ["globaladmin"],
});

const USAGE = {
  inputTokens: {
    cacheRead: undefined,
    cacheWrite: undefined,
    noCache: 1,
    total: 1,
  },
  outputTokens: { reasoning: undefined, text: 1, total: 1 },
};

interface DepCall {
  input: unknown;
  name: string;
}

function recordingDeps(calls: DepCall[]): AssistantActionDeps {
  const names = [
    "approveRequest",
    "createContent",
    "createM365User",
    "deleteContent",
    "publishContent",
    "rejectRequest",
    "searchContent",
    "toggleFeatureFlag",
    "updateContent",
  ];
  return Object.fromEntries(
    names.map((name) => [
      name,
      // biome-ignore lint/suspicious/useAwait: deps are async by contract
      async (input: unknown) => {
        calls.push({ input, name });
        return { data: "ok" };
      },
    ])
  );
}

function toolCallStream(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
) {
  return convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    {
      input: JSON.stringify(input),
      toolCallId,
      toolName,
      type: "tool-call",
    },
    {
      finishReason: { raw: undefined, unified: "tool-calls" },
      type: "finish",
      usage: USAGE,
    },
  ]);
}

function textStream() {
  return convertArrayToReadableStream([
    { type: "stream-start", warnings: [] },
    { id: "t1", type: "text-start" },
    { delta: "Done.", id: "t1", type: "text-delta" },
    { id: "t1", type: "text-end" },
    {
      finishReason: { raw: undefined, unified: "stop" },
      type: "finish",
      usage: USAGE,
    },
  ]);
}

/** Calls one tool on its first step, then answers with text. */
function toolCallModel(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
) {
  let streamed = 0;
  return new MockLanguageModelV4({
    doStream: () => {
      streamed += 1;
      return Promise.resolve({
        stream:
          streamed === 1
            ? toolCallStream(toolCallId, toolName, input)
            : textStream(),
      });
    },
  });
}

function textModel() {
  return new MockLanguageModelV4({
    doStream: async () => ({ stream: textStream() }),
  });
}

interface Clock {
  now: number;
}

function gateFor(
  userId: string,
  clock: Clock,
  used: Map<string, number>
): ConfirmationGate {
  return createConfirmationGate({
    now: () => clock.now,
    secret: SECRET,
    usedConfirmations: used,
    userId,
  });
}

async function runTurn(options: {
  gate: ConfirmationGate;
  messages: ModelMessage[];
  model: MockLanguageModelV4;
  sdkSignature?: boolean;
  deps: AssistantActionDeps;
  withApproval?: boolean;
}) {
  const tools = buildAssistantTools(GLOBAL_ADMIN, options.deps, options.gate);
  const result = streamText({
    model: options.model,
    messages: options.messages,
    // Rejected signatures surface as stream errors; the assertions are on deps.
    onError: () => undefined,
    tools,
    stopWhen: isStepCount(3),
    ...(options.withApproval === false
      ? {}
      : { toolApproval: options.gate.toolApproval }),
    ...(options.sdkSignature === false
      ? {}
      : { experimental_toolApprovalSecret: options.gate.approvalSecret }),
  });
  const partTypes: string[] = [];
  try {
    for await (const part of result.fullStream) {
      partTypes.push(part.type);
    }
  } catch {
    partTypes.push("thrown");
  }
  let responseMessages: ModelMessage[] = [];
  try {
    responseMessages = (await result.response).messages;
  } catch {
    responseMessages = [];
  }
  return { partTypes, responseMessages };
}

const USER_ASKS: ModelMessage = {
  content: "Publish job A",
  role: "user",
};

function approvalIdIn(messages: ModelMessage[]): string {
  for (const message of messages) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-approval-request") {
        return part.approvalId;
      }
    }
  }
  throw new Error("no approval request in messages");
}

function clickConfirm(
  history: ModelMessage[],
  approvalId: string
): ModelMessage[] {
  return [
    ...history,
    {
      content: [{ approvalId, approved: true, type: "tool-approval-response" }],
      role: "tool",
    },
  ];
}

/** Turn 1: the model asks to publish job A; returns the history the client would hold. */
async function requestPublish(
  gate: ConfirmationGate,
  deps: AssistantActionDeps,
  toolCallId = "call-1"
) {
  const { partTypes, responseMessages } = await runTurn({
    deps,
    gate,
    messages: [USER_ASKS],
    model: toolCallModel(toolCallId, "publishContent", {
      domain: "jobs",
      id: "job-a",
    }),
  });
  return {
    history: [USER_ASKS, ...responseMessages],
    partTypes,
  };
}

function mapToolCalls(
  history: ModelMessage[],
  edit: (part: { input: unknown; toolName: string }) => void
): ModelMessage[] {
  const copy = structuredClone(history);
  for (const message of copy) {
    if (message.role !== "assistant" || typeof message.content === "string") {
      continue;
    }
    for (const part of message.content) {
      if (part.type === "tool-call") {
        edit(part);
      }
    }
  }
  return copy;
}

describe("assistant write confirmation", () => {
  test("a write tool called without a confirmation doesn't write", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const { partTypes } = await requestPublish(gate, recordingDeps(calls));

    expect(calls).toEqual([]);
    expect(partTypes).toContain("tool-approval-request");
  });

  test("the guard refuses a write even when the route passes no approval policy", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const deps = recordingDeps(calls);
    for (const [toolName, input] of [
      ["publishContent", { domain: "jobs", id: "job-a" }],
      ["deleteContent", { domain: "jobs", id: "job-a" }],
      ["updateContent", { domain: "jobs", id: "job-a", payload: {} }],
      ["createContent", { domain: "jobs", payload: {}, publish: false }],
      ["approveRequest", { requestId: "req-1" }],
      ["rejectRequest", { reason: "no", requestId: "req-1" }],
      ["toggleFeatureFlag", { enabled: true, flagKey: "x" }],
      [
        "createM365User",
        {
          campus: "Oslo",
          department: "IT",
          firstName: "A",
          lastName: "B",
          upnPrefix: "a.b",
        },
      ],
    ] as const) {
      await runTurn({
        deps,
        gate,
        messages: [USER_ASKS],
        model: toolCallModel(`call-${toolName}`, toolName, input),
        sdkSignature: false,
        withApproval: false,
      });
    }

    expect(calls).toEqual([]);
  });

  test("the user's confirmation runs that exact action once", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const deps = recordingDeps(calls);
    const { history } = await requestPublish(gate, deps);

    clock.now = T0 + 30_000;
    await runTurn({
      deps,
      gate,
      messages: clickConfirm(history, approvalIdIn(history)),
      model: textModel(),
    });

    expect(calls).toEqual([
      { input: { domain: "jobs", id: "job-a" }, name: "publishContent" },
    ]);
  });

  test("a confirmation for action A can't execute action B", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const deps = recordingDeps(calls);
    const { history } = await requestPublish(gate, deps);
    const approvalId = approvalIdIn(history);

    const otherJob = mapToolCalls(history, (part) => {
      part.input = { domain: "jobs", id: "job-b" };
    });
    const otherTool = mapToolCalls(history, (part) => {
      part.toolName = "deleteContent";
    });

    for (const sdkSignature of [true, false]) {
      for (const tampered of [otherJob, otherTool]) {
        await runTurn({
          deps,
          gate,
          messages: clickConfirm(tampered, approvalId),
          model: textModel(),
          sdkSignature,
        });
      }
    }

    expect(calls).toEqual([]);
  });

  test("a confirmation can't be replayed", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const used = new Map<string, number>();
    const gate = gateFor("user-a", clock, used);
    const deps = recordingDeps(calls);
    const { history } = await requestPublish(gate, deps);
    const confirmed = clickConfirm(history, approvalIdIn(history));

    await runTurn({ deps, gate, messages: confirmed, model: textModel() });
    await runTurn({ deps, gate, messages: confirmed, model: textModel() });
    // A fresh gate for the same user on the same server shares the used set.
    await runTurn({
      deps,
      gate: gateFor("user-a", clock, used),
      messages: confirmed,
      model: textModel(),
    });

    expect(calls).toHaveLength(1);
  });

  test("a confirmation expires", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const deps = recordingDeps(calls);
    const { history } = await requestPublish(gate, deps);

    clock.now = T0 + CONFIRMATION_TTL_MS + 1;
    await runTurn({
      deps,
      gate,
      messages: clickConfirm(history, approvalIdIn(history)),
      model: textModel(),
    });

    expect(calls).toEqual([]);
  });

  test("a confirmation issued to one user doesn't run for another", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const deps = recordingDeps(calls);
    const { history } = await requestPublish(
      gateFor("user-a", clock, new Map()),
      deps
    );

    for (const sdkSignature of [true, false]) {
      await runTurn({
        deps,
        gate: gateFor("user-b", clock, new Map()),
        messages: clickConfirm(history, approvalIdIn(history)),
        model: textModel(),
        sdkSignature,
      });
    }

    expect(calls).toEqual([]);
  });

  test("a click on the card in the chat UI runs the write", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const deps = recordingDeps(calls);
    const tools = buildAssistantTools(GLOBAL_ADMIN, deps, gate);
    const streamOptions = {
      experimental_toolApprovalSecret: gate.approvalSecret,
      onError: () => undefined,
      stopWhen: isStepCount(3),
      toolApproval: gate.toolApproval,
      tools,
    };
    const userMessage: UIMessage = {
      id: "u1",
      parts: [{ text: "Publish job A", type: "text" }],
      role: "user",
    };

    // Turn 1, as the route streams it and useChat reads it.
    const first = streamText({
      ...streamOptions,
      messages: await convertToModelMessages([userMessage]),
      model: toolCallModel("call-ui", "publishContent", {
        domain: "jobs",
        id: "job-a",
      }),
    });
    let assistant: UIMessage | undefined;
    for await (const message of readUIMessageStream<UIMessage>({
      stream: toUIMessageStream({ stream: first.stream, tools }),
    })) {
      assistant = message;
    }
    expect(calls).toEqual([]);

    // The click: what addToolApprovalResponse does to the part.
    const clicked = structuredClone(assistant) as UIMessage;
    for (const part of clicked.parts as Record<string, unknown>[]) {
      if (part.state === "approval-requested") {
        part.state = "approval-responded";
        part.approval = {
          ...(part.approval as Record<string, unknown>),
          approved: true,
        };
      }
    }
    // The request body is JSON.
    const body = JSON.parse(JSON.stringify([userMessage, clicked]));

    const second = streamText({
      ...streamOptions,
      messages: await convertToModelMessages(body),
      model: textModel(),
    });
    await second.consumeStream();

    expect(calls).toEqual([
      { input: { domain: "jobs", id: "job-a" }, name: "publishContent" },
    ]);
  });

  test("read-only tools run without a confirmation", async () => {
    const calls: DepCall[] = [];
    const clock = { now: T0 };
    const gate = gateFor("user-a", clock, new Map());
    const { partTypes } = await runTurn({
      deps: recordingDeps(calls),
      gate,
      messages: [{ content: "Find jobs", role: "user" }],
      model: toolCallModel("call-r", "searchContent", {
        domain: "jobs",
        limit: 5,
      }),
    });

    expect(calls).toEqual([
      {
        input: {
          domain: "jobs",
          limit: 5,
          query: undefined,
          status: undefined,
        },
        name: "searchContent",
      },
    ]);
    expect(partTypes).not.toContain("tool-approval-request");
  });
});

/** Calls a tool's execute the way the SDK does, with no confirmation in the messages. */
function executeUnconfirmed(tools: ToolSet, toolName: string) {
  const execute = tools[toolName]?.execute;
  if (!execute) {
    throw new Error(`${toolName} has no execute`);
  }
  return execute(
    {},
    { context: undefined, messages: [], toolCallId: `call-${toolName}` }
  );
}

describe("which tools are gated", () => {
  test("every server tool is either listed read-only or gated", async () => {
    const calls: DepCall[] = [];
    const gate = gateFor("user-a", { now: T0 }, new Map());
    const tools = buildAssistantTools(GLOBAL_ADMIN, recordingDeps(calls), gate);
    const gated: string[] = [];

    for (const [toolName, candidate] of Object.entries(tools)) {
      const approval = gate.toolApproval({
        toolCall: { input: {}, toolCallId: `call-${toolName}`, toolName },
        tools,
      });
      if (typeof candidate.execute !== "function") {
        // Client tools run in the browser and are never gated.
        expect(approval).toBeUndefined();
        continue;
      }
      if (READ_ONLY_TOOL_NAMES.has(toolName)) {
        expect(approval).toBeUndefined();
        continue;
      }
      gated.push(toolName);
      expect(approval).toMatchObject({ type: "user-approval" });
      expect(await executeUnconfirmed(tools, toolName)).toMatchObject({
        confirmationRequired: true,
        success: false,
      });
    }

    expect(calls).toEqual([]);
    expect(gated.sort()).toEqual([
      "approveRequest",
      "createContent",
      "createM365User",
      "deleteContent",
      "publishContent",
      "rejectRequest",
      "toggleFeatureFlag",
      "updateContent",
    ]);
    // The read-only list names only tools that exist and run on the server.
    for (const toolName of READ_ONLY_TOOL_NAMES) {
      expect(typeof tools[toolName]?.execute).toBe("function");
    }
  });

  test("a new server tool is gated until it is listed read-only", async () => {
    const ran: unknown[] = [];
    const gate = gateFor("user-a", { now: T0 }, new Map());
    const archiveEverything = tool({
      description: "A tool added later",
      execute: (input) => {
        ran.push(input);
        return Promise.resolve({ success: true });
      },
      inputSchema: z.object({}),
    });
    const tools = gate.guardTools({ archiveEverything });

    expect(needsConfirmation("archiveEverything", archiveEverything)).toBe(
      true
    );
    expect(needsConfirmation("navigate", clientTools.navigate)).toBe(false);
    expect(needsConfirmation("searchContent", { execute: () => null })).toBe(
      false
    );

    const result = streamText({
      experimental_toolApprovalSecret: gate.approvalSecret,
      messages: [USER_ASKS],
      model: toolCallModel("call-new", "archiveEverything", {}),
      onError: () => undefined,
      stopWhen: isStepCount(3),
      toolApproval: gate.toolApproval,
      tools,
    });
    const partTypes: string[] = [];
    for await (const part of result.fullStream) {
      partTypes.push(part.type);
    }

    expect(partTypes).toContain("tool-approval-request");
    expect(await executeUnconfirmed(tools, "archiveEverything")).toMatchObject({
      confirmationRequired: true,
    });
    expect(ran).toEqual([]);
  });
});
