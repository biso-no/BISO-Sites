// @vitest-environment happy-dom
import { act, createElement, lazy, Suspense } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchErrorBoundary } from "./search-error-boundary";

const { captureException, flush } = vi.hoisted(() => ({
  captureException: vi.fn(),
  flush: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("@sentry/nextjs", () => ({ captureException, flush }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let onClose = vi.fn();
let onUncaughtError = vi.fn();
let assign = vi.fn();

function Thrower(): never {
  throw new Error("quick search broke");
}

async function render(child: ReturnType<typeof createElement>, query = "") {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container, { onUncaughtError });
  await act(async () => {
    root?.render(
      createElement(
        SearchErrorBoundary,
        { onClose, readQuery: () => query },
        child
      )
    );
    await Promise.resolve();
  });
  // Reporting runs before the full page load.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  onClose = vi.fn();
  onUncaughtError = vi.fn();
  assign = vi.fn();
  vi.spyOn(window.location, "assign").mockImplementation(assign);
  // React reports the caught error on the console; the test checks the path.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  captureException.mockClear();
});

describe("SearchErrorBoundary", () => {
  it("closes search and loads the search page with the query", async () => {
    await render(createElement(Thrower), "winter");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith("/search?q=winter");
    expect(onUncaughtError).not.toHaveBeenCalled();
  });

  it("reports the error to Sentry without the query", async () => {
    await render(createElement(Thrower), "private name");
    expect(captureException).toHaveBeenCalledTimes(1);
    const args = captureException.mock.calls[0] as unknown[];
    expect(args).toHaveLength(1);
    expect((args[0] as Error).message).toBe("quick search broke");
    expect(JSON.stringify(args)).not.toContain("private");
  });

  it("loads the bare search page when nothing was typed", async () => {
    await render(createElement(Thrower), "  ");
    expect(assign).toHaveBeenCalledWith("/search");
  });

  it("catches a quick-search chunk that failed to load", async () => {
    const Broken = lazy(() => Promise.reject(new Error("ChunkLoadError")));
    await render(
      createElement(Suspense, { fallback: null }, createElement(Broken))
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(assign).toHaveBeenCalledWith("/search");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onUncaughtError).not.toHaveBeenCalled();
  });

  it("renders its children while nothing is wrong", async () => {
    await render(createElement("p", null, "results"));
    expect(document.body.textContent).toBe("results");
    expect(assign).not.toHaveBeenCalled();
  });
});
