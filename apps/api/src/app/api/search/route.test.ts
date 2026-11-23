import { MeilisearchApiError, MeilisearchRequestError } from "meilisearch";
import { beforeEach, describe, expect, it, vi } from "vitest";

const multiSearch = vi.hoisted(() => vi.fn());
const configured = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/search", () => ({
  searchRunnerFromEnv: () =>
    configured.value
      ? {
          indexName: "search_entries",
          runner: { multiSearch },
        }
      : null,
}));

import { GET, OPTIONS } from "./route";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;

function request(query = "", headers: Record<string, string> = {}) {
  return new Request(`https://api.biso.no/api/search${query}`, {
    headers,
  }) as never;
}

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured.value = true;
    multiSearch.mockResolvedValue([]);
  });

  it("answers an empty query without calling Meilisearch", async () => {
    expect((await GET(request("?q="))).status).toBe(200);
    expect(await (await GET(request("?q=&mode=page"))).json()).toMatchObject({
      mode: "page",
      hits: [],
      total: 0,
      total_pages: 0,
      page: 1,
    });
    const quick = await (await GET(request("?q="))).json();
    expect(quick).toMatchObject({ mode: "quick", best: null, total: 0 });
    expect(multiSearch).not.toHaveBeenCalled();
  });

  it("returns results with CORS and no-store headers", async () => {
    const ok = await GET(
      request("?q=winter&locale=en&campus=2", { origin: "https://biso.no" })
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
    expect(ok.headers.get("cache-control")).toBe("private, no-store");
    expect((await ok.json()).mode).toBe("quick");
    expect(multiSearch).toHaveBeenCalled();
  });

  it("answers 502 with the error code and status, never the query", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    multiSearch.mockRejectedValueOnce(
      new MeilisearchApiError(new Response(null, { status: 403 }), {
        message: "key rejected for winter",
        code: "invalid_api_key",
        type: "auth",
        link: "https://docs",
      })
    );
    const bad = await GET(request("?q=winter"));
    expect(bad.status).toBe(502);
    expect(await bad.json()).toEqual({
      error: "Search is unavailable",
      code: "UPSTREAM_ERROR",
    });
    const logged = consoleError.mock.calls.flat().join(" ");
    expect(logged).toContain("MeilisearchApiError");
    expect(logged).toContain("code=invalid_api_key");
    expect(logged).toContain("status=403");
    expect(logged).not.toContain("winter");
    consoleError.mockRestore();
  });

  it("logs the network error code of a request failure", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const network = new TypeError("fetch failed", {
      cause: Object.assign(new Error("connect winter"), {
        code: "ECONNREFUSED",
      }),
    });
    multiSearch.mockRejectedValueOnce(
      new MeilisearchRequestError(
        "https://search.example/multi-search",
        network
      )
    );
    expect((await GET(request("?q=winter"))).status).toBe(502);
    const logged = consoleError.mock.calls.flat().join(" ");
    expect(logged).toContain("MeilisearchRequestError");
    expect(logged).toContain("cause_code=ECONNREFUSED");
    expect(logged).not.toContain("winter");
    consoleError.mockRestore();
  });

  it("answers 200 for malformed parameters", async () => {
    const response = await GET(
      request("?q=winter&page=abc&type=foo&locale=de&campus=9&mode=page")
    );
    expect(response.status).toBe(200);
    expect(multiSearch).toHaveBeenCalled();
  });

  it("answers 200 and never splits a surrogate pair in q", async () => {
    const q = encodeURIComponent(`${"a".repeat(99)}\u{1F600}b`);
    const response = await GET(request(`?q=${q}`));
    expect(response.status).toBe(200);
    const sent = multiSearch.mock.calls[0][0][0].q as string;
    expect(Array.from(sent)).toHaveLength(100);
    expect(sent).not.toMatch(LONE_SURROGATE);
  });

  it("answers 503 when search is not configured", async () => {
    configured.value = false;
    const response = await GET(request("?q=winter"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Search is not configured",
      code: "NOT_CONFIGURED",
    });
  });

  it("answers the preflight", () => {
    const response = OPTIONS(
      request("", { origin: "https://www.biso.no" }) as never
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://www.biso.no"
    );
  });
});
