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
