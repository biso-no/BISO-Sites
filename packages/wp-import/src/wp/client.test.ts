import { describe, expect, test } from "bun:test";
import { WpClient } from "./client";

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
