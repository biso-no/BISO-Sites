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
      totalPages: 0,
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

  it("answers 502 without logging the query when Meilisearch fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    multiSearch.mockRejectedValueOnce(
      Object.assign(new Error("connect ECONNREFUSED winter"), {
        code: "ECONNREFUSED",
      })
    );
    const bad = await GET(request("?q=winter"));
    expect(bad.status).toBe(502);
    expect(await bad.json()).toEqual({
      error: "Search is unavailable",
      code: "UPSTREAM_ERROR",
    });
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("winter");
    consoleError.mockRestore();
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
