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
});
