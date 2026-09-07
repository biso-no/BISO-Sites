import { describe, expect, test } from "bun:test";
import { WpClient, type WpProgressEvent } from "./client";

const RETRY_EXHAUSTED = /after 3 retries \(network error/;

function stubFetch(pages: Array<{ body: unknown; totalPages: number }>) {
  let call = 0;
  return (): Promise<Response> => {
    const page = pages[call];
    call += 1;
    if (!page) {
      throw new Error("fetch called more times than expected");
    }
    return Promise.resolve(
      new Response(JSON.stringify(page.body), {
        headers: { "X-WP-TotalPages": String(page.totalPages) },
        status: 200,
      })
    );
  };
}

describe("WpClient.fetchAllPages", () => {
  test("concatenates every page reported by X-WP-TotalPages", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubFetch([
        { body: [{ id: 1 }], totalPages: 2 },
        { body: [{ id: 2 }], totalPages: 2 },
      ]),
    });

    const rows = await client.fetchAllPages<{ id: number }>("/wp/v2/product");

    expect(rows).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test("stops after one page when only one page exists", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubFetch([{ body: [{ id: 1 }], totalPages: 1 }]),
    });

    const rows = await client.fetchAllPages<{ id: number }>("/wp/v2/product");

    expect(rows).toHaveLength(1);
  });

  test("throws a descriptive error on 401 so a partial import cannot happen", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });

    await expect(client.fetchAllPages("/wc/v3/orders")).rejects.toThrow("401");
  });

  test("does not leak the WooCommerce consumer secret into the thrown error message", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      consumerKey: "ck_leaky_key",
      consumerSecret: "cs_super_secret",
      fetchImpl: async () => new Response("nope", { status: 401 }),
    });

    let message = "";
    try {
      await client.fetchAllPages("/wc/v3/orders");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain("401");
    expect(message).not.toContain("cs_super_secret");
    expect(message).not.toContain("ck_leaky_key");
  });

  test("sends WooCommerce credentials as a Basic auth header, never as query params", async () => {
    let capturedUrl = "";
    let capturedHeaders: HeadersInit | undefined;
    const client = new WpClient({
      baseUrl: "https://example.test",
      consumerKey: "ck_123",
      consumerSecret: "cs_456",
      fetchImpl: (input, init) => {
        capturedUrl = String(input);
        capturedHeaders = init?.headers;
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            headers: { "X-WP-TotalPages": "1" },
            status: 200,
          })
        );
      },
    });

    await client.fetchAllPages("/wc/v3/orders");

    expect(capturedUrl).not.toContain("consumer_key");
    expect(capturedUrl).not.toContain("consumer_secret");
    const headers = new Headers(capturedHeaders);
    expect(headers.get("Authorization")).toBe(
      `Basic ${Buffer.from("ck_123:cs_456").toString("base64")}`
    );
  });

  test("does not attach WooCommerce credentials to non-/wc/v3 requests", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const client = new WpClient({
      baseUrl: "https://example.test",
      consumerKey: "ck_123",
      consumerSecret: "cs_456",
      fetchImpl: (_input, init) => {
        capturedHeaders = init?.headers;
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            headers: { "X-WP-TotalPages": "1" },
            status: 200,
          })
        );
      },
    });

    await client.fetchAllPages("/wp/v2/product");

    const headers = new Headers(capturedHeaders);
    expect(headers.get("Authorization")).toBeNull();
  });
});

describe("WpClient progress reporting", () => {
  test("emits a page event per page with cumulative counts and the X-WP-Total header", async () => {
    const events: WpProgressEvent[] = [];
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: () => {
        const call = events.length;
        return Promise.resolve(
          new Response(JSON.stringify([{ id: call }, { id: call + 100 }]), {
            headers: {
              "X-WP-Total": "4",
              "X-WP-TotalPages": "2",
            },
            status: 200,
          })
        );
      },
      onProgress: (event) => events.push(event),
    });

    await client.fetchAllPages("/wc/v3/orders");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      kind: "page",
      page: 1,
      path: "/wc/v3/orders",
      received: 2,
      total: 4,
      totalPages: 2,
    });
    expect(events[1]).toMatchObject({ page: 2, received: 4 });
  });

  test("emits a retry event naming the timeout, then succeeds on the next attempt", async () => {
    const events: WpProgressEvent[] = [];
    let attempts = 0;
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: () => {
        attempts += 1;
        if (attempts === 1) {
          const timeout = new Error("The operation timed out.");
          timeout.name = "TimeoutError";
          return Promise.reject(timeout);
        }
        return Promise.resolve(
          new Response(JSON.stringify([{ id: 1 }]), {
            headers: { "X-WP-TotalPages": "1" },
            status: 200,
          })
        );
      },
      onProgress: (event) => events.push(event),
      timeoutMs: 25,
    });

    const rows = await client.fetchAllPages("/wc/v3/orders");

    expect(rows).toHaveLength(1);
    const retry = events.find((event) => event.kind === "retry");
    expect(retry).toMatchObject({
      attempt: 1,
      maxRetries: 3,
      reason: "timeout after 25ms",
    });
  });

  test("does not retry a definitive HTTP status", async () => {
    let attempts = 0;
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: () => {
        attempts += 1;
        return Promise.resolve(new Response("nope", { status: 404 }));
      },
    });

    await expect(client.fetchAllPages("/wc/v3/orders")).rejects.toThrow("404");
    expect(attempts).toBe(1);
  });

  test("gives up after the retry budget and reports the last transport failure", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: () => Promise.reject(new Error("socket hang up")),
      timeoutMs: 25,
    });

    await expect(client.fetchAllPages("/wc/v3/orders")).rejects.toThrow(
      RETRY_EXHAUSTED
    );
  });
});

/** Reads the `page` query param off whatever shape fetch was handed. */
function pageOf(input: RequestInfo | URL): number {
  const url = typeof input === "string" ? input : input.toString();
  return Number(new URL(url).searchParams.get("page") ?? "1");
}

/**
 * Page-aware stub: the concurrent walk no longer requests pages in call order,
 * so a stub keyed on call count (see stubFetch above) cannot describe it.
 */
function stubPagedFetch(
  totalPages: number,
  options: { onRequest?: () => Promise<void> } = {}
) {
  const requestedPages: number[] = [];
  const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
    const page = pageOf(input);
    requestedPages.push(page);
    await options.onRequest?.();
    return new Response(JSON.stringify([{ id: page }]), {
      headers: {
        "X-WP-Total": String(totalPages),
        "X-WP-TotalPages": String(totalPages),
      },
      status: 200,
    });
  };
  return { fetchImpl, requestedPages };
}

describe("WpClient.fetchAllPages concurrency", () => {
  test("returns rows in page order even when later pages resolve first", async () => {
    // Page 4 resolves immediately, page 2 last — if the client concatenated in
    // completion order the ids below would come back shuffled.
    const delays: Record<number, number> = { 2: 30, 3: 20, 4: 0 };
    const client = new WpClient({
      baseUrl: "https://example.test",
      concurrency: 3,
      fetchImpl: async (input: RequestInfo | URL) => {
        const page = pageOf(input);
        await new Promise((resolve) => setTimeout(resolve, delays[page] ?? 0));
        return new Response(JSON.stringify([{ id: page }]), {
          headers: { "X-WP-TotalPages": "4" },
          status: 200,
        });
      },
    });

    const rows = await client.fetchAllPages<{ id: number }>("/wc/v3/orders");

    expect(rows).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });

  test("fetches page 1 alone, then overlaps the rest up to the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const { fetchImpl, requestedPages } = stubPagedFetch(6, {
      onRequest: async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight -= 1;
      },
    });
    const client = new WpClient({
      baseUrl: "https://example.test",
      concurrency: 3,
      fetchImpl,
    });

    await client.fetchAllPages("/wc/v3/orders");

    expect(peak).toBe(3);
    expect(requestedPages[0]).toBe(1);
    expect([...requestedPages].sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  test("reports progress with a monotonic received count as pages land", async () => {
    const events: number[] = [];
    const { fetchImpl } = stubPagedFetch(5);
    const client = new WpClient({
      baseUrl: "https://example.test",
      concurrency: 2,
      fetchImpl,
      onProgress: (event) => {
        if (event.kind === "page") {
          events.push(event.received);
        }
      },
    });

    await client.fetchAllPages("/wc/v3/orders");

    expect(events).toEqual([1, 2, 3, 4, 5]);
  });

  test("surfaces a failing page instead of silently returning a short result", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      concurrency: 3,
      fetchImpl: (input: RequestInfo | URL) => {
        const page = pageOf(input);
        if (page === 3) {
          return Promise.resolve(new Response("gone", { status: 404 }));
        }
        return Promise.resolve(
          new Response(JSON.stringify([{ id: page }]), {
            headers: { "X-WP-TotalPages": "5" },
            status: 200,
          })
        );
      },
    });

    await expect(client.fetchAllPages("/wc/v3/orders")).rejects.toThrow("404");
  });
});
