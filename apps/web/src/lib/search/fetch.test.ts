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

/** A fetch that never answers on its own and rejects when its signal aborts. */
function hangingFetch() {
  return vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        });
      })
  );
}

const nativeAny = AbortSignal.any;

describe.each([
  ["AbortSignal.any available", false],
  ["AbortSignal.any missing (Safari < 17.4)", true],
])("fetchSearch aborts with %s", (_label, removeAny) => {
  afterEach(() => {
    AbortSignal.any = nativeAny;
    vi.useRealTimers();
  });

  const setup = () => {
    if (removeAny) {
      Reflect.deleteProperty(AbortSignal, "any");
    }
  };

  it("rethrows the caller's own abort unchanged", async () => {
    setup();
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const pending = fetchSearch(
      { q: "x", locale: "no", mode: "quick" },
      { signal: controller.signal, timeoutMs: 10_000 }
    );
    controller.abort();
    const error = await pending.catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(SearchUnavailableError);
    expect((error as Error).name).toBe("AbortError");
  });

  it("turns a timeout into SearchUnavailableError", async () => {
    setup();
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    await expect(
      fetchSearch(
        { q: "x", locale: "no", mode: "quick" },
        { signal: controller.signal, timeoutMs: 20 }
      )
    ).rejects.toBeInstanceOf(SearchUnavailableError);
    expect(controller.signal.aborted).toBe(false);
  });

  it("still answers when the caller passes no signal", async () => {
    setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ mode: "quick" }))
    );
    await expect(
      fetchSearch({ q: "x", locale: "no", mode: "quick" })
    ).resolves.toEqual({ mode: "quick" });
  });
});

describe("fetchSearch without AbortSignal.any", () => {
  afterEach(() => {
    AbortSignal.any = nativeAny;
    vi.useRealTimers();
  });

  it("clears its timer and caller listener once the answer is in", async () => {
    Reflect.deleteProperty(AbortSignal, "any");
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ mode: "quick" }))
    );
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    await fetchSearch(
      { q: "x", locale: "no", mode: "quick" },
      { signal: controller.signal }
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
