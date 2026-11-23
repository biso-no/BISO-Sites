// @vitest-environment happy-dom
import { loadMessages } from "@repo/i18n/messages";
import {
  emptyQuickResponse,
  type QuickSearchResponse,
} from "@repo/shared/search/response";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  searchHit as hit,
  winterResponse as resp,
} from "@/test/search-fixtures";

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: ({ src }: { src: string }) =>
    createElement("img", { alt: "", src }),
}));

import {
  optionDomId,
  QUICK_SEARCH_LISTBOX_ID,
  quickOptions,
  SHOW_ALL_OPTION_ID,
} from "./quick-options";
import { QuickSearchInput } from "./quick-search-input";
import {
  QuickSearchResults,
  quickOptions as reExportedQuickOptions,
} from "./quick-search-results";
import type { QuickSearchState } from "./use-quick-search";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const PANEL_GRID_WITH_BEST = "lg:grid-cols-[18rem_minmax(0,1fr)]";

const domIds = (response: QuickSearchResponse, listboxId: string) =>
  quickOptions(response, "winter").map((o) => optionDomId(listboxId, o.id));

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

let root: Root | null = null;
let container: HTMLDivElement;

interface RenderProps {
  activeId?: string | null;
  campusSlug?: string | null;
  layout?: "panel" | "sheet";
  listboxId?: string;
  onNavigate?: (href: string) => void;
  onPickQuery?: (q: string) => void;
  query?: string;
  state: QuickSearchState;
}

async function render(props: RenderProps) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(() => {
    root?.render(
      createElement(QuickSearchResults, {
        activeId: null,
        campusSlug: null,
        layout: "panel",
        onNavigate: () => undefined,
        onPickQuery: () => undefined,
        query: "winter",
        ...props,
      })
    );
  });
}

const options = () => [...container.querySelectorAll('[role="option"]')];
const links = () =>
  [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
const showAllOption = () =>
  document.getElementById(
    optionDomId(QUICK_SEARCH_LISTBOX_ID, SHOW_ALL_OPTION_ID)
  );

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(async () => {
  await act(() => {
    root?.unmount();
  });
  root = null;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("QuickSearchResults (ready, panel)", () => {
  it("renders one option per quick option, in a listbox", async () => {
    await render({ state: { status: "ready", response: resp } });
    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox?.id).toBe(QUICK_SEARCH_LISTBOX_ID);
    expect(options().map((o) => o.id)).toEqual(
      domIds(resp, QUICK_SEARCH_LISTBOX_ID)
    );
  });

  it("keeps quickOptions importable from the results module", () => {
    expect(reExportedQuickOptions).toBe(quickOptions);
  });

  it("shows the total, the matched word and the show-all link", async () => {
    await render({ state: { status: "ready", response: resp } });
    expect(container.textContent).toContain("23");
    expect(container.querySelector("mark")?.textContent).toBe("Winter");
    expect(showAllOption()?.getAttribute("href")).toBe("/search?q=winter");
    expect(showAllOption()?.textContent).toBe("showAll 23 winter");
  });

  it("announces the result count in a polite live region", async () => {
    await render({ state: { status: "ready", response: resp } });
    const live = container.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("resultsCount 23");
  });

  it("names non-empty groups with their counts and omits empty ones", async () => {
    await render({ state: { status: "ready", response: resp } });
    const text = container.textContent ?? "";
    expect(text).toContain("groups.event");
    expect(text).toContain("groups.unit");
    expect(text).not.toContain("groups.page");
    const groups = [...container.querySelectorAll('[role="group"]')];
    const labels = groups.map((group) =>
      document
        .getElementById(group.getAttribute("aria-labelledby") ?? "")
        ?.textContent?.trim()
    );
    expect(labels).toContain("groups.event6");
  });

  it("gives the best event a date block and the rows one meta line", async () => {
    await render({ state: { status: "ready", response: resp } });
    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2027-02-12");
    const text = container.textContent ?? "";
    expect(text).toContain("Hafjell");
    expect(text).toContain("meta.applyBy");
    expect(text).toContain("meta.outOfStock");
  });

  it("marks only the active option as selected", async () => {
    await render({
      state: { status: "ready", response: resp },
      activeId: "news_tickets_en",
    });
    const selected = options().filter(
      (o) => o.getAttribute("aria-selected") === "true"
    );
    expect(selected.map((o) => o.id)).toEqual([
      optionDomId(QUICK_SEARCH_LISTBOX_ID, "news_tickets_en"),
    ]);
    expect(options().every((o) => o.hasAttribute("aria-selected"))).toBe(true);
  });

  it("scopes option ids by the listbox it is given", async () => {
    await render({
      state: { status: "ready", response: resp },
      listboxId: "header-search",
    });
    expect(container.querySelector('[role="listbox"]')?.id).toBe(
      "header-search"
    );
    expect(options().map((o) => o.id)).toEqual(domIds(resp, "header-search"));
  });

  it("calls onNavigate on a plain click and leaves modified clicks to the browser", async () => {
    const onNavigate = vi.fn();
    await render({ state: { status: "ready", response: resp }, onNavigate });
    const first = options()[0] as HTMLAnchorElement;
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(() => {
      first.dispatchEvent(plain);
    });
    expect(onNavigate).toHaveBeenCalledWith("/events/winter-games-2027");
    expect(plain.defaultPrevented).toBe(true);

    const modified = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      metaKey: true,
    });
    await act(() => {
      first.dispatchEvent(modified);
    });
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(modified.defaultPrevented).toBe(false);
  });

  it("shows keyboard hints on the panel", async () => {
    await render({ state: { status: "ready", response: resp } });
    expect(container.querySelectorAll("kbd").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("hints.move");
  });
});

describe("QuickSearchResults (single result)", () => {
  const single: QuickSearchResponse = {
    ...emptyQuickResponse("winter", "en"),
    best: hit({
      id: "news_only_en",
      group: "news",
      image: "https://appwrite.biso.no/news.jpg",
    }),
    counts: { ...emptyQuickResponse("winter", "en").counts, news: 1 },
    total: 1,
  };

  it("keeps the best match in its card-sized column with no groups beside it", async () => {
    await render({ state: { status: "ready", response: single } });
    const listbox = container.querySelector('[role="listbox"]');
    const grid = listbox?.firstElementChild;
    expect(grid?.className).toContain(PANEL_GRID_WITH_BEST);
    expect(options()[0].className).toContain("max-w-72");
    expect(options().map((o) => o.id)).toEqual(
      domIds(single, QUICK_SEARCH_LISTBOX_ID)
    );
    expect(container.querySelectorAll('[role="group"]').length).toBe(1);
  });
});

describe("QuickSearchResults (page rows)", () => {
  it("shows where a page sits in words, and nothing path-like for a top-level page", async () => {
    const pages = {
      ...resp,
      groups: {
        ...resp.groups,
        page: [
          hit({
            id: "page_packing_en",
            group: "page",
            url: "/projects/winter-games/packing-list",
          }),
          hit({
            id: "coded_membership_en",
            group: "page",
            type: "coded",
            campus_id: "all",
            campus_name: "All campuses",
            url: "/membership",
          }),
        ],
      },
    };
    await render({ state: { status: "ready", response: pages } });
    const text = container.textContent ?? "";
    expect(text).toContain("Projects / Winter games");
    expect(text).not.toContain("winter-games");
    expect(text).not.toContain("biso.no");
    expect(text).not.toContain("All campuses");
  });
});

describe("QuickSearchResults (ready, sheet)", () => {
  it("puts the best match first and show all last, without key hints", async () => {
    await render({
      state: { status: "ready", response: resp },
      layout: "sheet",
    });
    expect(options().map((o) => o.id)).toEqual(
      domIds(resp, QUICK_SEARCH_LISTBOX_ID)
    );
    expect(container.querySelector("kbd")).toBeNull();
  });
});

describe("QuickSearchResults (other states)", () => {
  it("keeps the previous results navigable while loading", async () => {
    await render({ state: { status: "loading", previous: resp } });
    expect(options().length).toBe(quickOptions(resp, "winter").length);
    expect(
      container.querySelector('[role="listbox"]')?.hasAttribute("aria-busy")
    ).toBe(false);
  });

  it("labels show all with the shown answer's query, but links to what is typed now", async () => {
    await render({
      state: { status: "loading", previous: resp },
      query: "winter games",
    });
    expect(showAllOption()?.textContent).toBe("showAll 23 winter");
    expect(showAllOption()?.getAttribute("href")).toBe(
      "/search?q=winter+games"
    );
  });

  it("renders no options while the first search loads", async () => {
    await render({ state: { status: "loading", previous: null } });
    expect(options().length).toBe(0);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("shows the error and a link to the search page", async () => {
    const onNavigate = vi.fn();
    await render({ state: { status: "error" }, onNavigate });
    expect(container.textContent).toContain("error.title");
    expect(container.textContent).toContain("error.body");
    expect(links()).toContain("/search?q=winter");
    const link = container.querySelector(
      'a[href="/search?q=winter"]'
    ) as HTMLAnchorElement;
    await act(() => {
      link.click();
    });
    expect(onNavigate).toHaveBeenCalledWith("/search?q=winter");
  });

  it("says nothing matched and links to events, news and jobs", async () => {
    await render({
      state: { status: "ready", response: emptyQuickResponse("winter", "en") },
    });
    expect(container.textContent).toContain("empty.title winter");
    expect(container.textContent).toContain("empty.body");
    expect(links()).toEqual(
      expect.arrayContaining(["/events", "/news", "/jobs"])
    );
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "resultsCount 0"
    );
  });
});

describe("QuickSearchResults (idle)", () => {
  it("lists recent searches as buttons that fill the query", async () => {
    vi.stubGlobal(
      "localStorage",
      memoryStorage({ "biso.search.recent": JSON.stringify(["jobs"]) })
    );
    const onPickQuery = vi.fn();
    await render({ state: { status: "idle" }, query: "", onPickQuery });
    const button = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "jobs"
    );
    expect(button).toBeDefined();
    await act(() => {
      button?.click();
    });
    expect(onPickQuery).toHaveBeenCalledWith("jobs");
  });

  it("clears recent searches", async () => {
    const storage = memoryStorage({
      "biso.search.recent": JSON.stringify(["jobs"]),
    });
    vi.stubGlobal("localStorage", storage);
    await render({ state: { status: "idle" }, query: "" });
    const clear = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "recent.clear"
    );
    await act(() => {
      clear?.click();
    });
    expect(storage.getItem("biso.search.recent")).toBeNull();
    expect(container.textContent).not.toContain("recent.title");
  });

  it("omits the recent list when there is none", async () => {
    await render({ state: { status: "idle" }, query: "" });
    expect(container.textContent).not.toContain("recent.title");
  });

  it("links the shortcuts to the visitor's campus events, jobs and the shop", async () => {
    await render({
      state: { status: "idle" },
      query: "",
      campusSlug: "bergen",
    });
    expect(links()).toEqual(["/events?campus=bergen", "/jobs", "/shop"]);
  });

  it("links to all events without a campus", async () => {
    await render({ state: { status: "idle" }, query: "" });
    expect(links()).toContain("/events");
  });

  it("navigates through onNavigate from a shortcut", async () => {
    const onNavigate = vi.fn();
    await render({ state: { status: "idle" }, query: "", onNavigate });
    const shop = container.querySelector(
      'a[href="/shop"]'
    ) as HTMLAnchorElement;
    await act(() => {
      shop.click();
    });
    expect(onNavigate).toHaveBeenCalledWith("/shop");
  });
});

describe("QuickSearchResults (lead visuals)", () => {
  it("frames a news image and gives a unit logo no frame", async () => {
    const news = hit({
      id: "news_x_en",
      group: "news",
      image: "https://appwrite.biso.no/news.jpg",
    });
    await render({
      state: { status: "ready", response: { ...resp, best: news } },
    });
    expect(
      container.querySelector(".chevron-frame img")?.getAttribute("src")
    ).toBe("https://appwrite.biso.no/news.jpg");
    await act(() => {
      root?.unmount();
    });

    const unit = hit({
      id: "unit_x_en",
      group: "unit",
      image: "https://appwrite.biso.no/logo.png",
    });
    await render({
      state: { status: "ready", response: { ...resp, best: unit } },
    });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".chevron-frame")).toBeNull();
  });
});

describe("search.showAll copy", () => {
  async function translate(locale: "en" | "no", count: number) {
    const { createTranslator } =
      await vi.importActual<typeof import("next-intl")>("next-intl");
    const messages = await loadMessages(locale);
    const t = createTranslator({ locale, messages, namespace: "search" });
    return t("showAll", { count, query: "winter" });
  }

  it("reads naturally for one result", async () => {
    expect(await translate("en", 1)).toBe('Show 1 result for "winter"');
    expect(await translate("no", 1)).toBe("Vis 1 treff for «winter»");
  });

  it("says all for several", async () => {
    expect(await translate("en", 23)).toBe('Show all 23 results for "winter"');
    expect(await translate("no", 23)).toBe("Vis alle 23 treff for «winter»");
  });
});

describe("QuickSearchInput", () => {
  async function renderInput(
    activeId: string | null,
    expanded: boolean,
    listboxId = QUICK_SEARCH_LISTBOX_ID
  ) {
    const onChange = vi.fn();
    const onKeyDown = vi.fn();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(() => {
      root?.render(
        createElement(QuickSearchInput, {
          activeId,
          expanded,
          inputRef: null,
          listboxId,
          onChange,
          onKeyDown,
          value: "win",
        })
      );
    });
    return {
      input: container.querySelector("input") as HTMLInputElement,
      onChange,
      onKeyDown,
    };
  }

  it("is a list-autocomplete combobox that controls the listbox", async () => {
    const { input } = await renderInput("event_games_en", true);
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-controls")).toBe(QUICK_SEARCH_LISTBOX_ID);
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      optionDomId(QUICK_SEARCH_LISTBOX_ID, "event_games_en")
    );
    expect(input.getAttribute("aria-label")).toBe("field.label");
    expect(input.getAttribute("placeholder")).toBe("field.placeholder");
    expect(input.value).toBe("win");
  });

  it("points aria-activedescendant into its own listbox", async () => {
    const { input } = await renderInput("show-all", true, "sheet-search");
    expect(input.getAttribute("aria-controls")).toBe("sheet-search");
    expect(input.getAttribute("aria-activedescendant")).toBe(
      "sheet-search-opt-show-all"
    );
  });

  it("drops aria-activedescendant with no active option", async () => {
    const { input } = await renderInput(null, false);
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("reports typing and key presses", async () => {
    const { input, onChange, onKeyDown } = await renderInput(null, false);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    await act(() => {
      setter?.call(input, "wint");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith("wint");
    await act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" })
      );
    });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
