import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSearch, SearchUnavailableError, searchUrl } from "./fetch";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchUrl", () => {
  it("builds the quick query", () => {
    expect(
      searchUrl(
        { q: "winter games", locale: "en", campus: "2", mode: "quick" },
        "https://api.biso.no"
      )
    ).toBe(
      "https://api.biso.no/api/search?q=winter+games&locale=en&campus=2&mode=quick"
    );
  });

  it("adds type, page and only_campus for the page mode", () => {
    const url = searchUrl(
      {
        q: "x",
        locale: "no",
        group: "job",
        page: 2,
        onlyCampus: true,
        campus: "1",
        mode: "page",
      },
      "https://a"
    );
    expect(url).toContain("type=job");
    expect(url).toContain("page=2");
    expect(url).toContain("only_campus=1");
  });
});

describe("fetchSearch", () => {
  it("throws SearchUnavailableError on a non-2xx answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response('{"error":"x","code":"y"}', { status: 502 })
      )
    );
    await expect(
      fetchSearch({ q: "x", locale: "no", mode: "quick" })
    ).rejects.toBeInstanceOf(SearchUnavailableError);
  });

  it("throws SearchUnavailableError on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network")))
    );
    await expect(
      fetchSearch({ q: "x", locale: "no", mode: "page" })
    ).rejects.toBeInstanceOf(SearchUnavailableError);
  });

  it("returns the parsed body and sends no credentials", async () => {
    const body = { mode: "quick", total: 0 };
    const spy = vi.fn(async () => Response.json(body));
    vi.stubGlobal("fetch", spy);
    await expect(
      fetchSearch({ q: "x", locale: "no", mode: "quick" })
    ).resolves.toEqual(body);
    const init = (spy.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.credentials).toBe("omit");
  });
});
