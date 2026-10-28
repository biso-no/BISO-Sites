import { expect, test } from "bun:test";
import { type AnswerState, parseSources, requestAnswer } from "./use-ask";

const SOURCES = [{ n: 1, title: "Book interviews", url: "/guide/book" }];

function header(value: unknown): string {
  return encodeURIComponent(JSON.stringify(value));
}

function textStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function respond(response: Response): typeof fetch {
  return (() => Promise.resolve(response)) as unknown as typeof fetch;
}

async function run(
  fetcher: typeof fetch,
  question = "How do I book?",
  signal = new AbortController().signal
): Promise<AnswerState[]> {
  const updates: AnswerState[] = [];
  await requestAnswer(
    { question },
    { fetcher, signal, onUpdate: (next) => updates.push(next) }
  );
  return updates;
}

test("streams the answer and reads the sources header", async () => {
  const updates = await run(
    respond(
      new Response(textStream(["Open ", "the candidate [1]."]), {
        headers: { "X-Docs-Sources": header(SOURCES) },
      })
    )
  );
  expect(updates[0]).toMatchObject({ status: "thinking", text: "" });
  expect(updates.some((u) => u.status === "streaming")).toBe(true);
  expect(updates.at(-1)).toEqual({
    question: "How do I book?",
    sources: SOURCES,
    status: "done",
    text: "Open the candidate [1].",
  });
});

test("posts JSON with the question and page", async () => {
  let seen: Request | undefined;
  const fetcher = ((input: RequestInfo, init?: RequestInit) => {
    seen = new Request(new URL(String(input), "http://docs.test"), init);
    return Promise.resolve(new Response(textStream(["ok"])));
  }) as unknown as typeof fetch;
  await requestAnswer(
    { question: "  Why?  ", pageUrl: "/guide/book" },
    { fetcher, signal: new AbortController().signal, onUpdate: () => undefined }
  );
  expect(seen?.method).toBe("POST");
  expect(new URL(seen?.url ?? "").pathname).toBe("/api/ask");
  expect(seen?.headers.get("content-type")).toBe("application/json");
  expect(await seen?.json()).toEqual({
    question: "Why?",
    pageUrl: "/guide/book",
  });
});

test("maps error statuses", async () => {
  const cases: [number, string][] = [
    [429, "rate_limited"],
    [400, "invalid"],
    [502, "failed"],
    [503, "failed"],
  ];
  for (const [status, error] of cases) {
    const updates = await run(
      respond(Response.json({ error: "x" }, { status }))
    );
    expect(updates.at(-1)).toMatchObject({ status: "error", error });
  }
});

test("a network error is a failure", async () => {
  const fetcher = (() =>
    Promise.reject(new TypeError("offline"))) as unknown as typeof fetch;
  expect((await run(fetcher)).at(-1)).toMatchObject({
    status: "error",
    error: "failed",
  });
});

test("an empty answer is a failure", async () => {
  expect((await run(respond(new Response("")))).at(-1)).toMatchObject({
    status: "error",
    error: "failed",
  });
});

test("a question over 500 characters is refused without a request", async () => {
  let called = false;
  const fetcher = (() => {
    called = true;
    return Promise.resolve(new Response("x"));
  }) as unknown as typeof fetch;
  const updates = await run(fetcher, "a".repeat(501));
  expect(called).toBe(false);
  expect(updates.at(-1)).toMatchObject({ status: "error", error: "invalid" });
});

test("an aborted request reports nothing more", async () => {
  const controller = new AbortController();
  const fetcher = ((_: RequestInfo, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError"))
      );
    })) as unknown as typeof fetch;
  const pending = run(fetcher, "Why?", controller.signal);
  controller.abort();
  const updates = await pending;
  expect(updates.map((u) => u.status)).toEqual(["thinking"]);
});

test("a bad sources header gives no sources", () => {
  expect(parseSources(null)).toEqual([]);
  expect(parseSources("%E0%A4%A")).toEqual([]);
  expect(parseSources(header({ n: 1 }))).toEqual([]);
  expect(
    parseSources(
      header([
        ...SOURCES,
        { n: 2, title: "Bad", url: "javascript:alert(1)" },
        { n: 3, title: "Off site", url: "//evil.test/x" },
        { n: "4", title: "Wrong type", url: "/guide" },
      ])
    )
  ).toEqual(SOURCES);
});
