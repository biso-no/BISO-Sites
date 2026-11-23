// @vitest-environment happy-dom
import type { QuickSearchResponse } from "@repo/shared/search/response";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchHit, winterBest, winterResponse } from "@/test/search-fixtures";

const push = vi.fn();
const fetchSearch = vi.fn();
const rememberSearch = vi.fn();
const trackEvent = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/events",
  useRouter: () => ({ push }),
}));
vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: ({ src }: { src: string }) =>
    createElement("img", { alt: "", src }),
}));
// The panel's fade runs on the Web Animations API, which happy-dom cancels
// with an unhandled AbortError on unmount. The shell's markup is what counts.
vi.mock("motion/react", () => ({
  motion: {
    div: ({
      animate: _animate,
      initial: _initial,
      transition: _transition,
      ...props
    }: Record<string, unknown>) => createElement("div", props),
  },
}));
vi.mock("@/lib/search/fetch", () => ({
  fetchSearch: (...args: unknown[]) => fetchSearch(...args),
}));
vi.mock("@/lib/search/recent", () => ({
  clearRecentSearches: vi.fn(),
  readRecentSearches: () => [],
  rememberSearch: (q: string) => rememberSearch(q),
}));
vi.mock("@repo/shared/utils/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
}));

import QuickSearch from "./quick-search";
import { QUICK_SEARCH_DEBOUNCE_MS } from "./use-quick-search";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const SHOW_ALL_DOM_ID = /show-all$/;

let root: Root | null = null;
let onClose = vi.fn();

async function render(
  props: Partial<{
    campusId: string | null;
    layout: "panel" | "sheet";
  }> = {}
) {
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      createElement(QuickSearch, {
        campusId: "2",
        layout: "panel",
        locale: "en",
        onClose,
        ...props,
      })
    );
  });
}

const input = () =>
  document.querySelector<HTMLInputElement>('input[role="combobox"]');

async function type(value: string) {
  const field = input();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  await act(() => {
    setter?.call(field, value);
    field?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Run the debounce and let the mocked request settle. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(QUICK_SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function press(key: string, target: EventTarget | null = input()) {
  await act(() => {
    target?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key })
    );
  });
}

async function search(
  query: string,
  response: QuickSearchResponse = winterResponse
) {
  fetchSearch.mockResolvedValue(response);
  await type(query);
  await settle();
}

beforeEach(() => {
  vi.useFakeTimers();
  onClose = vi.fn();
  push.mockReset();
  fetchSearch.mockReset();
  rememberSearch.mockReset();
  trackEvent.mockReset();
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("QuickSearch (panel)", () => {
  it("focuses the field when it opens", async () => {
    await render();
    expect(document.activeElement).toBe(input());
  });

  it("asks for the visitor's campus in their locale", async () => {
    await render();
    await search("winter");
    expect(fetchSearch).toHaveBeenCalledWith(
      { campus: "2", locale: "en", mode: "quick", q: "winter" },
      expect.anything()
    );
  });

  it("opens the option the arrow keys picked", async () => {
    await render();
    await search("winter");
    await press("ArrowDown");
    expect(input()?.getAttribute("aria-activedescendant")).toContain(
      winterBest.id
    );
    await press("Enter");
    expect(push).toHaveBeenCalledWith(winterBest.url);
    expect(rememberSearch).toHaveBeenCalledWith("winter");
    expect(trackEvent).toHaveBeenCalledWith("search", {
      queryLength: 6,
      surface: "quick",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes to the search page on Enter with nothing picked", async () => {
    await render();
    await search("winter");
    await press("Enter");
    expect(push).toHaveBeenCalledWith("/search?q=winter");
  });

  it("goes to the search page on Enter before any answer arrives", async () => {
    fetchSearch.mockReturnValue(new Promise(() => undefined));
    await render();
    await type("winter");
    await press("Enter");
    expect(push).toHaveBeenCalledWith("/search?q=winter");
  });

  it("does nothing on Enter with an empty field", async () => {
    await render();
    await press("Enter");
    expect(push).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it("wraps the arrow keys around the options", async () => {
    await render();
    await search("winter");
    await press("ArrowUp");
    // Up from nothing lands on the last option, "Show all".
    expect(input()?.getAttribute("aria-activedescendant")).toMatch(
      SHOW_ALL_DOM_ID
    );
    await press("ArrowDown");
    expect(input()?.getAttribute("aria-activedescendant")).toContain(
      winterBest.id
    );
  });

  it("forgets the picked option when the query changes", async () => {
    await render();
    await search("winter");
    await press("ArrowDown");
    await type("winter g");
    expect(input()?.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("closes on Escape from the field", async () => {
    await render();
    await press("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape from inside the panel", async () => {
    await render();
    await search("winter");
    const panel = document.getElementById("nav-panel-search");
    await press("Escape", panel?.querySelector("a") ?? null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button", async () => {
    await render();
    const close = document.querySelector<HTMLButtonElement>(
      'button[aria-label="close"]'
    );
    await act(() => {
      close?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders the results in a panel region with the field's listbox", async () => {
    await render();
    await search("winter");
    const panel = document.getElementById("nav-panel-search");
    expect(panel?.getAttribute("role")).toBe("region");
    const listbox = panel?.querySelector('[role="listbox"]');
    expect(listbox?.id).toBeTruthy();
    expect(input()?.getAttribute("aria-controls")).toBe(listbox?.id);
  });

  it("downloads documents with a full page load", async () => {
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => undefined);
    const doc = searchHit({
      group: "page",
      id: "doc_budget",
      url: "/api/documents/doc_budget/download",
    });
    await render();
    await search("budget", {
      ...winterResponse,
      best: doc,
      query: "budget",
    });
    await press("ArrowDown");
    await press("Enter");
    expect(assign).toHaveBeenCalledWith("/api/documents/doc_budget/download");
    expect(push).not.toHaveBeenCalled();
  });

  it("does not count a quick link as a search", async () => {
    await render();
    const shortcut = [...document.querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === "/jobs"
    );
    await act(() => {
      shortcut?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, button: 0, cancelable: true })
      );
    });
    expect(push).toHaveBeenCalledWith("/jobs");
    expect(trackEvent).not.toHaveBeenCalled();
    expect(rememberSearch).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("scopes the events quick link to the visitor's campus", async () => {
    await render({ campusId: "2" });
    const hrefs = [...document.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/events?campus=bergen");
  });
});

describe("QuickSearch (sheet)", () => {
  it("fills the screen on navy and locks the page behind it", async () => {
    await render({ layout: "sheet" });
    const sheet = document.querySelector('[role="dialog"]');
    expect(sheet?.className).toContain("fixed inset-0");
    expect(sheet?.getAttribute("data-surface")).toBe("deep");
    // On the body, so it rises above the page's other fixed layers.
    expect(sheet?.parentElement).toBe(document.body);
    expect(document.body.style.overflow).toBe("hidden");
    await act(() => {
      root?.unmount();
    });
    root = null;
    expect(document.body.style.overflow).toBe("");
  });

  it("reports searches from the sheet as the mobile surface", async () => {
    await render({ layout: "sheet" });
    await search("winter");
    await press("Enter");
    expect(trackEvent).toHaveBeenCalledWith("search", {
      queryLength: 6,
      surface: "quick-mobile",
    });
  });

  it("closes from the cancel button", async () => {
    await render({ layout: "sheet" });
    const cancel = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "cancel"
    );
    await act(() => {
      cancel?.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps focus inside the sheet", async () => {
    await render({ layout: "sheet" });
    const outside = document.createElement("button");
    document.body.append(outside);
    await act(() => {
      outside.focus();
    });
    expect(document.activeElement).toBe(input());
  });
});
