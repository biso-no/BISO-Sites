// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import { SearchTrigger } from "./search-trigger";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let onOpen = vi.fn();
let onPrefetch = vi.fn();

const button = () => document.querySelector("button") as HTMLButtonElement;

async function dispatch(event: Event) {
  await act(() => {
    button().dispatchEvent(event);
  });
}

beforeEach(async () => {
  onOpen = vi.fn();
  onPrefetch = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      createElement(SearchTrigger, {
        controls: "nav-panel-search",
        expanded: false,
        onOpen,
        onPrefetch,
        triggerRef: null,
      })
    );
  });
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
});

describe("SearchTrigger", () => {
  it("does not fetch the quick search just by rendering", () => {
    expect(onPrefetch).not.toHaveBeenCalled();
  });

  it("warms the quick search when the pointer arrives", async () => {
    // React derives pointerenter from pointerover.
    await dispatch(new MouseEvent("pointerover", { bubbles: true }));
    expect(onPrefetch).toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("warms the quick search on keyboard focus and on touch", async () => {
    await act(() => {
      button().focus();
    });
    expect(onPrefetch).toHaveBeenCalledTimes(1);
    await dispatch(new Event("touchstart", { bubbles: true }));
    expect(onPrefetch).toHaveBeenCalledTimes(2);
  });

  it("opens on click", async () => {
    await act(() => {
      button().click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
