import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { installReactDom, type TestElement } from "@/test/react-dom-harness";

// `next/navigation` is external (not one of the app's own `@/lib/*` shared
// modules), so mocking it here is fine — see CLAUDE.md's "never partially
// mock a shared lib module" rule, which this does not fall under.
const pushCalls: string[] = [];
let searchParamsString = "";

mock.module("next/navigation", () => ({
  usePathname: () => "/departments",
  useRouter: () => ({
    push: (url: string) => {
      pushCalls.push(url);
    },
  }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

const { useListParams, useUrlSearch } = await import("./use-list-params");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

beforeEach(() => {
  pushCalls.length = 0;
  searchParamsString = "";
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

async function mount(element: ReturnType<typeof createElement>) {
  const container = installedDom.document.createElement(
    "div"
  ) as unknown as TestElement;
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(element);
  });
}

// A filter change pushes a new URL, but `useSearchParams` keeps reporting the
// pre-navigation query string until the RSC navigation commits. The orders tab
// has several independent controls and a debounced search box, so a second
// change landing inside that window is ordinary, not exotic.
test("merges a second write against the first while the navigation is pending", async () => {
  let setParams:
    | ((
        updates: Record<string, string | number | null | undefined>,
        opts?: { keepPage?: boolean; pageKey?: string }
      ) => void)
    | null = null;

  function Probe() {
    setParams = useListParams().setParams;
    return null;
  }

  searchParamsString = "";
  await mount(createElement(Probe));

  await act(() => {
    setParams?.({ ostatus: "paid" });
  });
  await act(() => {
    setParams?.({ product: "prod-1" });
  });

  expect(pushCalls).toHaveLength(2);
  const second = new URLSearchParams(pushCalls[1]?.split("?")[1] ?? "");
  expect(second.get("product")).toBe("prod-1");
  expect(second.get("ostatus")).toBe("paid");
});

// ---------------------------------------------------------------------------
// useUrlSearch
// ---------------------------------------------------------------------------

describe("useUrlSearch", () => {
  const DELAY = 20;
  let latestSetValue: ((value: string) => void) | null = null;

  function Probe({ initialKey = "q" }: { initialKey?: string }) {
    const [, setValue] = useUrlSearch(initialKey, DELAY);
    latestSetValue = setValue;
    return null;
  }

  test("does not schedule a push when the value already equals the URL", async () => {
    searchParamsString = "q=hello";
    await mount(createElement(Probe));

    await act(async () => {
      await sleep(DELAY * 3);
    });

    expect(pushCalls).toHaveLength(0);
  });

  test("a changed value schedules exactly one push after the delay", async () => {
    searchParamsString = "q=hello";
    await mount(createElement(Probe));

    await act(() => {
      latestSetValue?.("world");
    });
    // Not yet — the debounce hasn't elapsed.
    expect(pushCalls).toHaveLength(0);

    await act(async () => {
      await sleep(DELAY * 3);
    });

    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toContain("q=world");
  });

  test("adopts a term restored by browser navigation instead of pushing the stale one back", async () => {
    const seen = { value: "" };
    let setValue: ((next: string) => void) | null = null;

    function BackProbe() {
      const [value, set] = useUrlSearch("q", DELAY);
      seen.value = value;
      setValue = set;
      return null;
    }

    searchParamsString = "q=hello";
    await mount(createElement(BackProbe));

    // The user edits the box and the debounced push lands.
    await act(() => {
      setValue?.("world");
    });
    await act(async () => {
      await sleep(DELAY * 3);
    });
    expect(pushCalls).toHaveLength(1);
    searchParamsString = "q=world";
    await act(() => {
      root?.render(createElement(BackProbe));
    });

    // Browser Back restores the previous term in the URL.
    searchParamsString = "q=hello";
    await act(() => {
      root?.render(createElement(BackProbe));
    });
    await act(async () => {
      await sleep(DELAY * 3);
    });

    // The hook must not write its stale draft back over the restored term,
    // which would silently undo the navigation.
    expect(pushCalls).toHaveLength(1);
    expect(seen.value).toBe("hello");
  });

  test("a rapid second change clears the first timer", async () => {
    searchParamsString = "q=hello";
    await mount(createElement(Probe));

    await act(() => {
      latestSetValue?.("first");
    });
    await act(async () => {
      await sleep(DELAY / 2);
    });
    await act(() => {
      latestSetValue?.("second");
    });
    await act(async () => {
      await sleep(DELAY * 3);
    });

    // Only the second change's timer ever fires — the first was cleared.
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toContain("q=second");
  });

  test('clearing to "" deletes the param rather than setting it empty', async () => {
    searchParamsString = "q=hello";
    await mount(createElement(Probe));

    await act(() => {
      latestSetValue?.("");
    });
    await act(async () => {
      await sleep(DELAY * 3);
    });

    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).not.toContain("q=");
  });
});

// ---------------------------------------------------------------------------
// useListParams
// ---------------------------------------------------------------------------

describe("useListParams", () => {
  let latestSetParams: ReturnType<typeof useListParams>["setParams"] | null =
    null;

  function Probe() {
    const { setParams } = useListParams();
    latestSetParams = setParams;
    return null;
  }

  test("setParams drops page unless keepPage is set", async () => {
    searchParamsString = "page=3&other=1";
    await mount(createElement(Probe));

    await act(() => {
      latestSetParams?.({ foo: "bar" });
    });

    expect(pushCalls).toHaveLength(1);
    const [url] = pushCalls;
    expect(url).toContain("foo=bar");
    expect(url).toContain("other=1");
    expect(url).not.toContain("page=");
  });

  test("setParams keeps page when keepPage is set", async () => {
    searchParamsString = "page=3&other=1";
    await mount(createElement(Probe));

    await act(() => {
      latestSetParams?.({ foo: "bar" }, { keepPage: true });
    });

    expect(pushCalls).toHaveLength(1);
    const [url] = pushCalls;
    expect(url).toContain("page=3");
    expect(url).toContain("foo=bar");
  });
});

// ---------------------------------------------------------------------------
// Alternate page keys
//
// A route rendering two independent tables pages one of them by a key other
// than `page` (the shop studio's orders tab uses `opage`). Resetting the
// hardcoded `page` there would leave the alternate key stale, landing the user
// on page 7 of a freshly narrowed result set — usually an empty table.
// ---------------------------------------------------------------------------

describe("alternate page keys", () => {
  let latestSetParams: ReturnType<typeof useListParams>["setParams"] | null =
    null;

  function Probe() {
    const { setParams } = useListParams();
    latestSetParams = setParams;
    return null;
  }

  test("setParams clears the alternate page key it is given", async () => {
    searchParamsString = "opage=7&ostatus=paid";
    await mount(createElement(Probe));

    await act(() => {
      latestSetParams?.({ ostatus: "refunded" }, { pageKey: "opage" });
    });

    expect(pushCalls).toHaveLength(1);
    const [url] = pushCalls;
    expect(url).toContain("ostatus=refunded");
    expect(url).not.toContain("opage=");
  });

  test("setParams leaves the default page key alone when given an alternate", async () => {
    searchParamsString = "page=4&opage=7";
    await mount(createElement(Probe));

    await act(() => {
      latestSetParams?.({ ostatus: "paid" }, { pageKey: "opage" });
    });

    const [url] = pushCalls;
    expect(url).toContain("page=4");
    expect(url).not.toContain("opage=");
  });

  test("keepPage still wins over an alternate page key", async () => {
    searchParamsString = "opage=7";
    await mount(createElement(Probe));

    await act(() => {
      latestSetParams?.(
        { ostatus: "paid" },
        { keepPage: true, pageKey: "opage" }
      );
    });

    expect(pushCalls[0]).toContain("opage=7");
  });

  describe("useUrlSearch", () => {
    const DELAY = 20;
    let latestSetValue: ((value: string) => void) | null = null;

    function SearchProbe() {
      const [, setValue] = useUrlSearch("oq", DELAY, { pageKey: "opage" });
      latestSetValue = setValue;
      return null;
    }

    test("a debounced search clears the alternate page key", async () => {
      searchParamsString = "opage=7&page=2";
      await mount(createElement(SearchProbe));

      await act(() => {
        latestSetValue?.("nordmann");
      });
      await act(async () => {
        await sleep(DELAY * 3);
      });

      expect(pushCalls).toHaveLength(1);
      const [url] = pushCalls;
      expect(url).toContain("oq=nordmann");
      expect(url).not.toContain("opage=");
      expect(url).toContain("page=2");
    });
  });
});
