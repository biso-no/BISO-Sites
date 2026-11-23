// @vitest-environment happy-dom
import {
  emptyQuickResponse,
  type QuickSearchResponse,
} from "@repo/shared/search/response";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { fetchSearch } from "@/lib/search/fetch";
import { type QuickSearchState, useQuickSearch } from "./use-quick-search";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

interface Call {
  input: { campus?: string | null; locale: string; mode: string; q: string };
  reject: (error: unknown) => void;
  resolve: (response: QuickSearchResponse) => void;
  signal: AbortSignal;
}

let calls: Call[] = [];
let fetcher = vi.fn();
let root: Root | null = null;
let current: ReturnType<typeof useQuickSearch> | null = null;

function makeFetcher() {
  return vi.fn(
    (input: Call["input"], init: { signal?: AbortSignal } = {}) =>
      new Promise<QuickSearchResponse>((resolve, reject) => {
        calls.push({
          input,
          reject,
          resolve,
          signal: init.signal as AbortSignal,
        });
      })
  );
}

function Harness(props: { campus: string | null }) {
  current = useQuickSearch({
    locale: "en",
    campus: props.campus,
    fetcher: fetcher as unknown as typeof fetchSearch,
  });
  return null;
}

async function mount(campus: string | null = "2") {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(createElement(Harness, { campus }));
  });
}

async function type(value: string) {
  await act(() => {
    current?.setQuery(value);
  });
}

/** Settle a fake request and let the hook's async callback finish. */
async function settle(fn: () => void) {
  await act(async () => {
    fn();
    await Promise.resolve();
  });
}

async function advance(ms: number) {
  await act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const state = (): QuickSearchState => {
  if (!current) {
    throw new Error("hook not mounted");
  }
  return current.state;
};

const response = (query: string, total = 3): QuickSearchResponse => ({
  ...emptyQuickResponse(query, "en"),
  total,
});

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  fetcher = makeFetcher();
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  current = null;
  vi.useRealTimers();
});

describe("useQuickSearch", () => {
  it("starts idle", async () => {
    await mount();
    expect(state()).toEqual({ status: "idle" });
    expect(current?.query).toBe("");
  });

  it("debounces typing into one request with locale, campus and quick mode", async () => {
    await mount("2");
    await type("w");
    await type("wi");
    await type("win");
    await advance(149);
    expect(fetcher).not.toHaveBeenCalled();
    await advance(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(calls[0].input).toEqual({
      q: "win",
      locale: "en",
      campus: "2",
      mode: "quick",
    });
    expect(state()).toEqual({ status: "loading", previous: null });
  });

  it("trims the query before sending it", async () => {
    await mount();
    await type("  winter  ");
    await advance(150);
    expect(calls[0].input.q).toBe("winter");
    expect(current?.query).toBe("  winter  ");
  });

  it("applies the answer for the latest query", async () => {
    await mount();
    await type("winter");
    await advance(150);
    const answer = response("winter");
    await settle(() => calls[0].resolve(answer));
    expect(state()).toEqual({ status: "ready", response: answer });
  });

  it("drops a stale answer that resolves after the newer one, and aborts it", async () => {
    await mount();
    await type("winte");
    await advance(150);
    await type("winter");
    await advance(150);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [a, b] = calls;
    expect(a.signal.aborted).toBe(true);
    expect(b.signal.aborted).toBe(false);

    await settle(() => b.resolve(response("winter")));
    await settle(() => a.resolve(response("winte")));
    const now = state();
    expect(now.status === "ready" && now.response.query).toBe("winter");
  });

  it("drops a stale error as well", async () => {
    await mount();
    await type("winte");
    await advance(150);
    await type("winter");
    await advance(150);
    const [a, b] = calls;
    await settle(() => b.resolve(response("winter")));
    await settle(() => a.reject(new Error("late failure")));
    expect(state().status).toBe("ready");
  });

  it("keeps showing the previous answer while the next one loads", async () => {
    await mount();
    await type("win");
    await advance(150);
    const first = response("win");
    await settle(() => calls[0].resolve(first));
    await type("wint");
    expect(state()).toEqual({ status: "loading", previous: first });
    await advance(150);
    expect(state()).toEqual({ status: "loading", previous: first });
  });

  it("reports an error when the fetcher rejects", async () => {
    await mount();
    await type("winter");
    await advance(150);
    await settle(() => calls[0].reject(new Error("down")));
    expect(state()).toEqual({ status: "error" });
  });

  it("does not carry an error's previous answer into the next search", async () => {
    await mount();
    await type("win");
    await advance(150);
    await settle(() => calls[0].resolve(response("win")));
    await type("wint");
    await advance(150);
    await settle(() => calls[1].reject(new Error("down")));
    await type("winte");
    expect(state()).toEqual({ status: "loading", previous: null });
  });

  it("goes idle on a blank query, aborts the pending request and forgets old results", async () => {
    await mount();
    await type("win");
    await advance(150);
    await settle(() => calls[0].resolve(response("win")));
    await type("wint");
    await advance(150);
    await type("   ");
    expect(state()).toEqual({ status: "idle" });
    expect(calls[1].signal.aborted).toBe(true);
    await advance(500);
    expect(fetcher).toHaveBeenCalledTimes(2);

    await type("j");
    expect(state()).toEqual({ status: "loading", previous: null });
  });

  it("aborts the pending request on unmount", async () => {
    await mount();
    await type("winter");
    await advance(150);
    await act(() => {
      root?.unmount();
    });
    root = null;
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("searches again when the campus changes", async () => {
    await mount("1");
    await type("winter");
    await advance(150);
    await act(() => {
      root?.render(createElement(Harness, { campus: "3" }));
    });
    await advance(150);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].input.campus).toBe("3");
  });
});
