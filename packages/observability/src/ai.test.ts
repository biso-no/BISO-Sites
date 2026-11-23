import { APICallError, NoObjectGeneratedError } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { traceAiCall, traceAiStream } from "./ai";

interface RecordedSpan {
  attributes: Record<string, unknown>;
  ends: number;
  name: string;
  op: string | undefined;
  status: { code: number; message?: string } | undefined;
}

const fake = vi.hoisted(() => {
  const spans: RecordedSpan[] = [];
  const makeSpan = (options: {
    attributes?: Record<string, unknown>;
    name: string;
    op?: string;
  }) => {
    const recorded: RecordedSpan = {
      attributes: { ...options.attributes },
      ends: 0,
      name: options.name,
      op: options.op,
      status: undefined,
    };
    spans.push(recorded);
    const span = {
      end: () => {
        recorded.ends += 1;
      },
      setAttribute: (key: string, value: unknown) => {
        recorded.attributes[key] = value;
        return span;
      },
      setAttributes: (attributes: Record<string, unknown>) => {
        Object.assign(recorded.attributes, attributes);
        return span;
      },
      setStatus: (status: { code: number; message?: string }) => {
        recorded.status = status;
        return span;
      },
    };
    return span;
  };
  return { makeSpan, spans };
});

vi.mock("@sentry/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/core")>();
  return {
    ...actual,
    startInactiveSpan: vi.fn(fake.makeSpan),
    // Like the SDK: the span ends once the callback's promise settles.
    startSpan: vi.fn(
      (
        options: Parameters<typeof fake.makeSpan>[0],
        callback: (span: unknown) => unknown
      ) => {
        const span = fake.makeSpan(options);
        const result = callback(span);
        return result instanceof Promise
          ? result.finally(() => span.end())
          : result;
      }
    ),
    withActiveSpan: vi.fn((_span: unknown, callback: () => unknown) =>
      callback()
    ),
  };
});

const MODEL = { modelId: "claude-haiku-5-5", provider: "anthropic.messages" };
const CANCELLED = { code: 2, message: "cancelled" };
const DEADLINE_EXCEEDED = { code: 2, message: "deadline_exceeded" };
const EMAIL = "ola@biso.no";
const PROMPT = "Summarise the expenses Ola Nordmann sent in October";

const lastSpan = (): RecordedSpan => {
  const span = fake.spans.at(-1);
  if (!span) {
    throw new Error("no span was started");
  }
  return span;
};

const attributeText = (span: RecordedSpan): string =>
  `${span.name} ${JSON.stringify(span.attributes)} ${JSON.stringify(span.status)}`;

afterEach(() => {
  fake.spans.length = 0;
});

describe("traceAiCall", () => {
  it("names a structured call per Sentry's AI request span", async () => {
    await traceAiCall(
      {
        functionId: "admin.job-description",
        model: MODEL,
        operation: "generate_object",
      },
      async () => ({ object: {}, usage: {} })
    );
    const span = lastSpan();
    expect(span.op).toBe("gen_ai.generate_content");
    expect(span.name).toBe("generate_content claude-haiku-5-5");
    expect(span.attributes).toMatchObject({
      "gen_ai.operation.name": "generate_content",
      "gen_ai.pipeline.name": "admin.job-description",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-haiku-5-5",
    });
  });

  it("names a chat call gen_ai.chat", async () => {
    await traceAiCall(
      { functionId: "docs.ask", model: MODEL, operation: "chat" },
      async () => ({})
    );
    expect(lastSpan().op).toBe("gen_ai.chat");
    expect(lastSpan().name).toBe("chat claude-haiku-5-5");
  });

  it("records token usage and the responding model", async () => {
    await traceAiCall(
      {
        functionId: "api.receipt-extract",
        model: MODEL,
        operation: "generate_object",
      },
      async () => ({
        object: {},
        response: { modelId: "claude-haiku-5-5-20261001" },
        usage: { inputTokens: 120, outputTokens: 30 },
      })
    );
    expect(lastSpan().attributes).toMatchObject({
      "gen_ai.response.model": "claude-haiku-5-5-20261001",
      "gen_ai.usage.input_tokens": 120,
      "gen_ai.usage.output_tokens": 30,
      "gen_ai.usage.total_tokens": 150,
    });
    expect(lastSpan().ends).toBe(1);
  });

  it("counts every step of a multi-step generateText", async () => {
    await traceAiCall(
      {
        functionId: "api.expense-check",
        model: MODEL,
        operation: "generate_text",
      },
      async () => ({
        text: "",
        totalUsage: { inputTokens: 900, outputTokens: 60 },
        usage: { inputTokens: 100, outputTokens: 20 },
      })
    );
    expect(lastSpan().op).toBe("gen_ai.generate_content");
    expect(lastSpan().attributes).toMatchObject({
      "gen_ai.pipeline.name": "api.expense-check",
      "gen_ai.usage.input_tokens": 900,
      "gen_ai.usage.output_tokens": 60,
      "gen_ai.usage.total_tokens": 960,
    });
  });

  it("returns the call's result unchanged", async () => {
    const result = { object: { reply: "hi" }, usage: { inputTokens: 1 } };
    await expect(
      traceAiCall(
        {
          functionId: "admin.recruitment-assistant",
          model: MODEL,
          operation: "generate_object",
        },
        async () => result
      )
    ).resolves.toBe(result);
  });

  it("keeps a model id string and leaves the provider out", async () => {
    await traceAiCall(
      {
        functionId: "api.expense-summary",
        model: "claude-haiku-5-5",
        operation: "generate_object",
      },
      async () => ({})
    );
    expect(lastSpan().attributes["gen_ai.request.model"]).toBe(
      "claude-haiku-5-5"
    );
    expect(lastSpan().attributes).not.toHaveProperty("gen_ai.provider.name");
  });

  it("puts no prompt or output on the span", async () => {
    await traceAiCall(
      {
        functionId: "api.expense-summary",
        model: MODEL,
        operation: "generate_object",
      },
      () =>
        Promise.resolve({
          object: { email: EMAIL, summary: PROMPT },
          text: EMAIL,
          usage: { inputTokens: 5, outputTokens: 2 },
        })
    );
    const text = attributeText(lastSpan());
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain(PROMPT);
  });

  it("tolerates a result with no usage", async () => {
    await traceAiCall(
      {
        functionId: "admin.content-translation",
        model: MODEL,
        operation: "generate_object",
      },
      async () => ({ object: {}, usage: { inputTokens: Number.NaN } })
    );
    expect(lastSpan().attributes).not.toHaveProperty(
      "gen_ai.usage.input_tokens"
    );
  });

  it("propagates the same error and marks the span failed, without its message", async () => {
    const error = new TypeError(`model down for ${EMAIL}`);
    await expect(
      traceAiCall(
        {
          functionId: "api.receipt-classify",
          model: MODEL,
          operation: "generate_object",
        },
        () => Promise.reject(error)
      )
    ).rejects.toBe(error);
    const span = lastSpan();
    expect(span.status).toEqual({ code: 2, message: "internal_error" });
    expect(span.attributes["error.type"]).toBe("TypeError");
    expect(attributeText(span)).not.toContain(EMAIL);
    expect(span.ends).toBe(1);
  });
});

describe("traceAiStream", () => {
  const meta = {
    functionId: "admin.assistant",
    model: MODEL,
    operation: "chat",
  } as const;

  it("starts a streaming chat span and returns what start returns", () => {
    const stream = { kind: "stream" };
    const result = traceAiStream(meta, () => stream);
    expect(result).toBe(stream);
    const span = lastSpan();
    expect(span.op).toBe("gen_ai.chat");
    expect(span.name).toBe("chat claude-haiku-5-5");
    expect(span.attributes).toMatchObject({
      "gen_ai.operation.name": "chat",
      "gen_ai.pipeline.name": "admin.assistant",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-haiku-5-5",
      "gen_ai.response.streaming": true,
    });
    expect(span.ends).toBe(0);
  });

  it("ends once on finish, with tokens and no output", () => {
    const { onAbort, onEnd, onError } = traceAiStream(
      meta,
      (callbacks) => callbacks
    );
    // The SDK's end event also carries the output; none of it is read.
    const endEvent = {
      text: `${EMAIL} ${PROMPT}`,
      usage: { inputTokens: 900, outputTokens: 100 },
    };
    onEnd(endEvent);
    onEnd({ usage: { inputTokens: 1, outputTokens: 1 } });
    onError({ error: new Error("late") });
    onAbort();
    const span = lastSpan();
    expect(span.ends).toBe(1);
    expect(span.status).toBeUndefined();
    expect(span.attributes).toMatchObject({
      "gen_ai.usage.input_tokens": 900,
      "gen_ai.usage.output_tokens": 100,
      "gen_ai.usage.total_tokens": 1000,
    });
    expect(attributeText(span)).not.toContain(EMAIL);
    expect(attributeText(span)).not.toContain(PROMPT);
  });

  it("ends once on error and marks it failed", () => {
    traceAiStream(meta, ({ onEnd, onError }) => {
      onError({ error: new RangeError(EMAIL) });
      onError({ error: new Error("again") });
      onEnd({ usage: { inputTokens: 3, outputTokens: 4 } });
    });
    const span = lastSpan();
    expect(span.ends).toBe(1);
    expect(span.status).toEqual({ code: 2, message: "internal_error" });
    expect(span.attributes["error.type"]).toBe("RangeError");
    expect(span.attributes).not.toHaveProperty("gen_ai.usage.input_tokens");
    expect(attributeText(span)).not.toContain(EMAIL);
  });

  it("ends once, cancelled, when the request goes away before the stream finishes", () => {
    const controller = new AbortController();
    const { onEnd } = traceAiStream(
      { ...meta, signal: controller.signal },
      (callbacks) => callbacks
    );
    expect(lastSpan().ends).toBe(0);
    controller.abort();
    onEnd({ usage: { inputTokens: 1, outputTokens: 1 } });
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual(CANCELLED);
    expect(lastSpan().attributes).not.toHaveProperty(
      "gen_ai.usage.input_tokens"
    );
  });

  it("ends at once, cancelled, when the request is already gone", () => {
    traceAiStream({ ...meta, signal: AbortSignal.abort() }, () => undefined);
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual(CANCELLED);
  });

  it("ends as timed out when a timeout aborts the request", () => {
    const controller = new AbortController();
    traceAiStream({ ...meta, signal: controller.signal }, () => undefined);
    controller.abort(new DOMException("too slow", "TimeoutError"));
    expect(lastSpan().status).toEqual(DEADLINE_EXCEEDED);
  });

  it("ends once on abort, cancelled", () => {
    traceAiStream(meta, ({ onAbort }) => {
      onAbort({ reason: new DOMException("aborted", "AbortError") });
      onAbort();
    });
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual(CANCELLED);
    expect(lastSpan().attributes["sentry.cancellation_reason"]).toBe(
      "cancelled"
    );
  });

  it("ends as timed out when the AI SDK's timeout aborts the stream", () => {
    traceAiStream(meta, ({ onAbort }) => {
      onAbort({
        reason: new DOMException("The operation timed out.", "TimeoutError"),
      });
    });
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual(DEADLINE_EXCEEDED);
    expect(lastSpan().attributes["sentry.cancellation_reason"]).toBe(
      "deadline_exceeded"
    );
  });

  it("ends as cancelled when an abort gives no reason", () => {
    traceAiStream(meta, ({ onAbort }) => {
      onAbort();
    });
    expect(lastSpan().status).toEqual(CANCELLED);
  });

  it("logs only the class and HTTP status of an AI SDK error", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const overloaded = new APICallError({
      message: `Overloaded while answering ${EMAIL}`,
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: { prompt: PROMPT },
      statusCode: 529,
      responseBody: `{"error":"${PROMPT}"}`,
    });
    const noObject = new NoObjectGeneratedError({
      message: "No object generated.",
      text: PROMPT,
      response: { id: "r", modelId: "m", timestamp: new Date(0) },
      usage: {} as never,
      finishReason: "stop",
    });
    traceAiStream(meta, ({ onErrorWithLog }) => {
      onErrorWithLog({ error: overloaded });
      onErrorWithLog({ error: noObject });
    });

    expect(consoleError.mock.calls).toEqual([
      ["[ai] admin.assistant stream failed:", "AI_APICallError (HTTP 529)"],
      ["[ai] admin.assistant stream failed:", "AI_NoObjectGeneratedError"],
    ]);
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual({ code: 2, message: "internal_error" });
    expect(lastSpan().attributes["error.type"]).toBe("AI_APICallError");
    consoleError.mockRestore();
  });

  it("logs another error's class and scrubbed message", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    traceAiStream(meta, ({ onErrorWithLog }) => {
      onErrorWithLog({ error: new TypeError(`tool failed for ${EMAIL}`) });
      onErrorWithLog({ error: "not an error" });
    });

    expect(consoleError.mock.calls).toEqual([
      [
        "[ai] admin.assistant stream failed:",
        "TypeError: tool failed for [redacted]",
      ],
      ["[ai] admin.assistant stream failed:", "UnknownError"],
    ]);
    consoleError.mockRestore();
  });

  it("onError logs nothing", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    traceAiStream(meta, ({ onError }) => {
      onError({ error: new Error("x") });
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("rethrows when start throws and ends the span failed", () => {
    const error = new Error("bad options");
    expect(() =>
      traceAiStream(meta, () => {
        throw error;
      })
    ).toThrow(error);
    expect(lastSpan().ends).toBe(1);
    expect(lastSpan().status).toEqual({ code: 2, message: "internal_error" });
  });
});
