import {
  createTransport,
  getCurrentScope,
  resolvedSyncPromise,
  type StreamedSpanJSON,
  setCurrentClient,
  spanToJSON,
} from "@sentry/core";
import { ServerRuntimeClient } from "@sentry/core/server";
import { afterEach, describe, expect, it } from "vitest";
import { traceAiCall, traceAiStream } from "./ai";

const MODEL = { modelId: "claude-sonnet-5-5", provider: "anthropic.messages" };
const EMAIL = "ola@biso.no";

afterEach(() => {
  getCurrentScope().setClient(undefined);
});

describe("AI tracing without a Sentry client", () => {
  it("returns the call's result", async () => {
    const result = { object: { email: EMAIL }, usage: {} };
    await expect(
      traceAiCall(
        {
          functionId: "ai.recruitment-email",
          model: MODEL,
          operation: "generate_object",
        },
        async () => result
      )
    ).resolves.toBe(result);
  });

  it("propagates the call's error", async () => {
    const error = new Error("down");
    await expect(
      traceAiCall(
        {
          functionId: "ai.recruitment-screening",
          model: MODEL,
          operation: "generate_object",
        },
        () => Promise.reject(error)
      )
    ).rejects.toBe(error);
  });

  it("returns the stream and takes every callback more than once", () => {
    const stream = { kind: "stream" };
    const result = traceAiStream(
      { functionId: "admin.page-editor-chat", model: MODEL, operation: "chat" },
      ({ onAbort, onEnd, onError }) => {
        onEnd({ usage: { inputTokens: 1, outputTokens: 1 } });
        onError({ error: new Error("x") });
        onAbort();
        onEnd({});
        return stream;
      }
    );
    expect(result).toBe(stream);
  });
});

describe("AI tracing with a real Sentry client", () => {
  const ended: StreamedSpanJSON[] = [];

  const useClient = (): void => {
    ended.length = 0;
    const client = new ServerRuntimeClient({
      dsn: "https://key@o1.ingest.de.sentry.io/2",
      integrations: [],
      stackParser: () => [],
      tracesSampleRate: 1,
      transport: (options) =>
        createTransport(options, () => resolvedSyncPromise({})),
    });
    setCurrentClient(client);
    client.init();
    client.on("spanEnd", (span) => {
      ended.push(spanToJSON(span));
    });
  };

  it("sends an AI request span with tokens and no content", async () => {
    useClient();
    await traceAiCall(
      {
        functionId: "ai.department-resolver",
        model: MODEL,
        operation: "generate_object",
      },
      async () => ({
        object: { resolutions: [{ email: EMAIL }] },
        usage: { inputTokens: 40, outputTokens: 2 },
      })
    );
    expect(ended).toHaveLength(1);
    const [span] = ended;
    expect(span?.name).toBe("generate_content claude-sonnet-5-5");
    expect(span?.status).toBe("ok");
    expect(span?.attributes).toMatchObject({
      "gen_ai.operation.name": "generate_content",
      "gen_ai.pipeline.name": "ai.department-resolver",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-sonnet-5-5",
      "gen_ai.usage.input_tokens": 40,
      "gen_ai.usage.output_tokens": 2,
      "sentry.op": "gen_ai.generate_content",
    });
    expect(JSON.stringify(span)).not.toContain(EMAIL);
  });

  it("ends a stream span exactly once, failed on error", () => {
    useClient();
    traceAiStream(
      { functionId: "docs.ask", model: MODEL, operation: "chat" },
      ({ onEnd, onError }) => {
        onError({ error: new Error(EMAIL) });
        onEnd({ usage: { inputTokens: 1, outputTokens: 1 } });
      }
    );
    expect(ended).toHaveLength(1);
    expect(ended[0]?.attributes?.["sentry.op"]).toBe("gen_ai.chat");
    expect(ended[0]?.status).toBe("error");
    expect(JSON.stringify(ended[0])).not.toContain(EMAIL);
  });

  it("marks an aborted stream cancelled and a timed-out one deadline_exceeded", () => {
    useClient();
    const meta = {
      functionId: "docs.ask",
      model: MODEL,
      operation: "chat",
    } as const;
    traceAiStream(meta, ({ onAbort }) => {
      onAbort({ reason: new DOMException("aborted", "AbortError") });
    });
    traceAiStream(meta, ({ onAbort }) => {
      onAbort({ reason: new DOMException("timed out", "TimeoutError") });
    });
    // Sentry's streamed spans send `cancelled` as `ok`; the attribute keeps
    // both early ends apart from a finished call.
    expect(ended.map((span) => span.status)).toEqual(["ok", "error"]);
    expect(
      ended.map((span) => span.attributes?.["sentry.cancellation_reason"])
    ).toEqual(["cancelled", "deadline_exceeded"]);
    expect(ended[1]?.attributes?.["sentry.status.message"]).toBe(
      "deadline_exceeded"
    );
  });
});
