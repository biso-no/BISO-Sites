import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import { SYSTEM_PROMPT } from "lib/assistant/prompt";
import { PRIVATE_PLACEHOLDER, type Source } from "lib/assistant/retrieve";
import { handleAsk } from "./route";

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
});

test("an empty or 501-character question returns 400", async () => {
  for (const question of ["   ", "x".repeat(501), 5]) {
    const res = await handleAsk(fresh({ question }), deps());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid" });
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
    deps(model({ error: new Error("boom") }))
  );
  for (const spy of logs) {
    expect(JSON.stringify(spy.mock.calls)).not.toContain(question);
  }
});

test("per-visitor limit returns 429 rate_limited", async () => {
  let last: Response | undefined;
  for (let i = 0; i < 9; i++) {
    last = await handleAsk(
      post({ question: "q" }, { "x-forwarded-for": "9.9.9.9" }),
      deps()
    );
    if (i < 8) {
      await last.text();
    }
  }
  expect(last?.status).toBe(429);
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
