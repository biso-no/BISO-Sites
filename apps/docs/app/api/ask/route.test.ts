import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { SYSTEM_PROMPT } from "lib/assistant/prompt";
import { PRIVATE_PLACEHOLDER, type Source } from "lib/assistant/retrieve";
import { handleAsk, POST } from "./route";

const SOURCES: Source[] = [
  {
    n: 1,
    title: "Create a vacancy",
    url: "/guide/hr/create-vacancy",
    text: `Open the form. ${PRIVATE_PLACEHOLDER}`,
  },
];

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

function model(opts?: {
  chunks?: unknown[];
  error?: Error;
}): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: () => {
      if (opts?.error) {
        return Promise.reject(opts.error);
      }
      return Promise.resolve({
        stream: simulateReadableStream({
          chunks: (opts?.chunks ?? [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Open the form " },
            { type: "text-delta", id: "t", delta: "[1]." },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage,
            },
          ]) as never,
        }),
      });
    },
  });
}

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://docs.test/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

let ip = 0;
const retrieve = async () => SOURCES;
function deps(m = model(), enabled = true) {
  return { model: m, retrieve, enabled };
}
function fresh(body: unknown) {
  ip += 1;
  return post(body, { "x-forwarded-for": `10.0.0.${ip}` });
}

const logs: ReturnType<typeof spyOn>[] = [];
beforeEach(() => {
  for (const name of ["log", "info", "warn", "error", "debug"] as const) {
    logs.push(spyOn(console, name).mockImplementation(() => undefined));
  }
});
afterEach(() => {
  for (const spy of logs.splice(0)) {
    spy.mockRestore();
  }
});

test("a disabled assistant returns 503 disabled", async () => {
  const res = await handleAsk(fresh({ question: "hi" }), deps(model(), false));
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: "disabled" });
  const m = model();
  await handleAsk(fresh({ question: "hi" }), deps(m, false));
  expect(m.doStreamCalls).toHaveLength(0);
});

test("an empty or 501-character question returns 400", async () => {
  const m = model();
  for (const question of ["   ", "x".repeat(501), 5]) {
    const res = await handleAsk(fresh({ question }), deps(m));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid" });
  }
  expect(m.doStreamCalls).toHaveLength(0);
});

test("a 500-character question is accepted", async () => {
  const res = await handleAsk(fresh({ question: "x".repeat(500) }), deps());
  expect(res.status).toBe(200);
  await res.text();
});

test("a body over the cap is refused by content-length and by bytes read", async () => {
  const m = model();
  const big = JSON.stringify({ question: "x", pad: "y".repeat(5000) });
  const declared = post(
    { question: "x", pad: "y".repeat(5000) },
    {
      "x-forwarded-for": "7.7.7.1",
    }
  );
  expect((await handleAsk(declared, deps(m))).status).toBe(400);

  // No content-length: a stream that keeps going past the cap.
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent += 1000;
      controller.enqueue(new TextEncoder().encode("a".repeat(1000)));
      if (sent > 100_000) {
        controller.close();
      }
    },
  });
  const chunked = new Request("http://docs.test/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "7.7.7.2",
    },
    body,
    duplex: "half",
  } as RequestInit);
  expect((await handleAsk(chunked, deps(m))).status).toBe(400);
  expect(sent).toBeLessThan(20_000);
  expect(big.length).toBeGreaterThan(4096);
  expect(m.doStreamCalls).toHaveLength(0);
});

test("a body that is not JSON content-type is refused", async () => {
  const req = new Request("http://docs.test/api/ask", {
    method: "POST",
    headers: { "content-type": "text/plain", "x-forwarded-for": "7.7.7.3" },
    body: JSON.stringify({ question: "hi" }),
  });
  expect((await handleAsk(req, deps())).status).toBe(400);
});

test("no sources means the note and no model call", async () => {
  const m = model();
  const res = await handleAsk(fresh({ question: "hi" }), {
    model: m,
    retrieve: async () => [],
    enabled: true,
  });
  expect(res.status).toBe(200);
  expect(await res.text()).toContain("docs search");
  expect(m.doStreamCalls).toHaveLength(0);
});

test("a length finish after some text appends the note", async () => {
  const res = await handleAsk(
    fresh({ question: "hi" }),
    deps(
      model({
        chunks: [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: "Half an" },
          { type: "text-end", id: "t" },
          {
            type: "finish",
            finishReason: { unified: "length", raw: "max_tokens" },
            usage,
          },
        ],
      })
    )
  );
  const text = await res.text();
  expect(text.startsWith("Half an")).toBe(true);
  expect(text).toContain("docs search");
});

test("a disconnect aborts the model call", async () => {
  const m = new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "text-start", id: "t" });
            controller.enqueue({ type: "text-delta", id: "t", delta: "Hi" });
            // Never ends: only an abort can stop it.
          },
        }) as never,
      }),
  });
  const controller = new AbortController();
  const req = new Request("http://docs.test/api/ask", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "7.7.7.4",
    },
    body: JSON.stringify({ question: "hi" }),
    signal: controller.signal,
  });
  const res = await handleAsk(req, deps(m));
  const reader = (res.body as ReadableStream<Uint8Array>).getReader();
  await reader.read();
  expect(m.doStreamCalls[0]?.abortSignal?.aborted).toBe(false);
  controller.abort();
  await reader.cancel();
  expect(m.doStreamCalls[0]?.abortSignal?.aborted).toBe(true);
});

test("POST wires the off switch to ANTHROPIC_API_KEY", async () => {
  const had = process.env.ANTHROPIC_API_KEY;
  Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
  const res = await POST(fresh({ question: "hi" }));
  expect(res.status).toBe(503);
  if (had !== undefined) {
    process.env.ANTHROPIC_API_KEY = had;
  }
});

test("invalid JSON and an unknown pageUrl return 400", async () => {
  const bad = new Request("http://docs.test/api/ask", {
    method: "POST",
    body: "{nope",
  });
  expect((await handleAsk(bad, deps())).status).toBe(400);
  const res = await handleAsk(
    fresh({ question: "hi", pageUrl: "/no/such/page" }),
    deps()
  );
  expect(res.status).toBe(400);
});

test("an ok request streams text with sources and no-store", async () => {
  const m = model();
  const res = await handleAsk(fresh({ question: "How do I?" }), deps(m));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/plain");
  expect(res.headers.get("cache-control")).toBe("no-store");
  const header = res.headers.get("x-docs-sources") ?? "";
  expect(JSON.parse(decodeURIComponent(header))).toEqual([
    { n: 1, title: "Create a vacancy", url: "/guide/hr/create-vacancy" },
  ]);
  expect(await res.text()).toBe("Open the form [1].");

  const call = m.doStreamCalls[0];
  expect(JSON.stringify(call?.prompt)).toContain(
    JSON.stringify(SYSTEM_PROMPT).slice(1, -1)
  );
  expect(JSON.stringify(call?.prompt)).toContain(PRIVATE_PLACEHOLDER);
  expect(call?.maxOutputTokens).toBe(1200);
  expect(call?.reasoning).toBe("low");
  expect(call?.temperature).toBeUndefined();
});

test("a model error before any text returns 502 failed", async () => {
  const res = await handleAsk(
    fresh({ question: "How do I?" }),
    deps(model({ error: new Error("boom secret-question") }))
  );
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "failed" });
});

test("a content filter finish ends the stream cleanly with a note", async () => {
  const res = await handleAsk(
    fresh({ question: "How do I?" }),
    deps(
      model({
        chunks: [
          {
            type: "finish",
            finishReason: { unified: "content-filter", raw: "refusal" },
            usage,
          },
        ],
      })
    )
  );
  expect(res.status).toBe(200);
  const text = await res.text();
  expect(text.length).toBeGreaterThan(0);
  expect(text).not.toContain("Error");
});

test("the handler never logs the question", async () => {
  const question = "my very secret question text";
  await (await handleAsk(fresh({ question }), deps())).text();
  await handleAsk(
    fresh({ question }),
    deps(model({ error: new Error(`failed on ${question}`) }))
  );
  for (const spy of logs) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(question);
  }
});

test("per-visitor limit returns 429 rate_limited", async () => {
  let last: Response | undefined;
  const m = model();
  for (let i = 0; i < 9; i++) {
    last = await handleAsk(
      post({ question: "q" }, { "x-forwarded-for": "9.9.9.9" }),
      deps(m)
    );
    if (i < 8) {
      await last.text();
    }
  }
  expect(last?.status).toBe(429);
  expect(m.doStreamCalls).toHaveLength(8);
  expect(await last?.json()).toEqual({ error: "rate_limited" });
});

test("GET reports enabled state", async () => {
  const { GET } = await import("./route");
  const had = process.env.ANTHROPIC_API_KEY;
  Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
  expect(await (await GET()).json()).toEqual({ enabled: false });
  process.env.ANTHROPIC_API_KEY = "x";
  expect(await (await GET()).json()).toEqual({ enabled: true });
  if (had === undefined) {
    Reflect.deleteProperty(process.env, "ANTHROPIC_API_KEY");
  } else {
    process.env.ANTHROPIC_API_KEY = had;
  }
});
