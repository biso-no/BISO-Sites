import { expect, test } from "bun:test";
import {
  type AnswerState,
  createAsker,
  parseSources,
  requestAnswer,
} from "./use-ask";

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

/** Each of these is rejected; several resolve to another origin. */
const NOT_DOCS_PATHS = [
  "/\\evil.test/x",
  "/\t/evil.test/x",
  "/\n/evil.test",
  "//evil.test",
  "https://evil.test",
  "javascript:alert(1)",
  "/.//evil",
  "/..//evil",
  "/a/..//evil",
  "/x/../..//evil.test/x",
  "%2F%2Fevil",
  "/a?b=1",
];

test("only docs page paths are kept as sources", () => {
  for (const url of NOT_DOCS_PATHS) {
    expect(parseSources(header([{ n: 1, title: "Off site", url }]))).toEqual(
      []
    );
  }
  for (const url of [
    "/",
    "/guide/shop",
    "/guide/shop/add-a-product#start-a-product",
  ]) {
    expect(parseSources(header([{ n: 1, title: "Here", url }]))).toEqual([
      { n: 1, title: "Here", url },
    ]);
  }
});

function hangingFetch(signals: AbortSignal[]): typeof fetch {
  return ((_: RequestInfo, init?: RequestInit) => {
    const signal = init?.signal as AbortSignal;
    signals.push(signal);
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError"))
      );
    });
  }) as unknown as typeof fetch;
}

test("a new question aborts the one before it", () => {
  const signals: AbortSignal[] = [];
  const asker = createAsker(() => undefined, hangingFetch(signals));
  asker.ask("First?");
  asker.ask("Second?");
  expect(signals.map((s) => s.aborted)).toEqual([true, false]);
});

test("cancel aborts the current question, as closing or unmounting does", () => {
  const signals: AbortSignal[] = [];
  const updates: AnswerState[] = [];
  const asker = createAsker((u) => updates.push(u), hangingFetch(signals));
  asker.ask("First?");
  asker.cancel();
  expect(signals[0]?.aborted).toBe(true);
  expect(updates.map((u) => u.status)).toEqual(["thinking"]);
});
