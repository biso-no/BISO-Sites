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

// `next/navigation` is an external framework module, not one of the app's own
// `@/lib/*` shared modules, so mocking it wholesale is fine here.
const pushCalls: string[] = [];
let searchParamsString = "";

mock.module("next/navigation", () => ({
  usePathname: () => "/shop",
  useRouter: () => ({
    push: (url: string) => {
      pushCalls.push(url);
    },
  }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

const { useShopParams } = await import("./use-shop-params");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let latest: ReturnType<typeof useShopParams> | null = null;

function Probe() {
  latest = useShopParams();
  return null;
}

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

beforeEach(() => {
  pushCalls.length = 0;
  searchParamsString = "";
  latest = null;
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
});

afterAll(() => installedDom.restore());

async function mount() {
  const container: TestElement = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(createElement(Probe));
  });
}

/** Substring assertions cannot tell `page=4` apart from `opage=4`. */
function pushedParams(index = 0): URLSearchParams {
  const url = pushCalls[index];
  if (!url) {
    throw new Error(`No push at index ${index}`);
  }
  return new URLSearchParams(url.split("?")[1] ?? "");
}

describe("catalog filters", () => {
  test("a status chip writes ?status= and resets the catalog page", async () => {
    searchParamsString = "page=3&opage=7";
    await mount();

    await act(() => latest?.setCatalogStatus("draft"));

    const params = pushedParams();
    expect(params.get("status")).toBe("draft");
    expect(params.get("page")).toBeNull();
    // The orders table is not being renarrowed, so its offset stands.
    expect(params.get("opage")).toBe("7");
  });

  test('the "all" chip clears the param rather than writing a sentinel', async () => {
    searchParamsString = "status=draft";
    await mount();

    await act(() => latest?.setCatalogStatus("all"));

    expect(pushedParams().get("status")).toBeNull();
  });
});

describe("orders filters", () => {
  // The trap: `setParams` resets a hardcoded `page`, but the orders table
  // pages by `opage`. Without an explicit page key a narrowed filter leaves a
  // stale `opage=7` behind and the user lands on page 7 of a much shorter
  // result set — in practice, an empty table.
  test("a status chip resets opage, not page", async () => {
    searchParamsString = "opage=7&page=3&tab=orders";
    await mount();

    await act(() => latest?.setOrderStatus("refunded"));

    const params = pushedParams();
    expect(params.get("ostatus")).toBe("refunded");
    expect(params.get("opage")).toBeNull();
    expect(params.get("page")).toBe("3");
  });

  test("the product filter resets opage and drops the all sentinel", async () => {
    searchParamsString = "opage=7&product=product-9";
    await mount();

    await act(() => latest?.setProduct("product-1"));
    expect(pushedParams(0).get("product")).toBe("product-1");
    expect(pushedParams(0).get("opage")).toBeNull();

    await act(() => latest?.setProduct("all"));
    expect(pushedParams(1).get("product")).toBeNull();
  });

  test("each date bound resets opage", async () => {
    searchParamsString = "opage=7";
    await mount();

    await act(() => latest?.setDateFrom("2026-01-01"));
    expect(pushedParams(0).get("from")).toBe("2026-01-01");
    expect(pushedParams(0).get("opage")).toBeNull();

    await act(() => latest?.setDateTo("2026-02-01"));
    expect(pushedParams(1).get("to")).toBe("2026-02-01");
    expect(pushedParams(1).get("opage")).toBeNull();
  });

  test("clearing the advanced filters drops product, dates and opage at once", async () => {
    searchParamsString =
      "opage=7&product=product-1&from=2026-01-01&to=2026-02-01&ostatus=paid";
    await mount();

    await act(() => latest?.clearOrderFilters());

    const params = pushedParams();
    expect(params.get("product")).toBeNull();
    expect(params.get("from")).toBeNull();
    expect(params.get("to")).toBeNull();
    expect(params.get("opage")).toBeNull();
    // The status chips are their own control and are not part of "clear".
    expect(params.get("ostatus")).toBe("paid");
  });
});

describe("tab switching", () => {
  test("switching to orders keeps both tables' offsets", async () => {
    searchParamsString = "page=3&opage=7";
    await mount();

    await act(() => latest?.setTab("orders"));

    const params = pushedParams();
    expect(params.get("tab")).toBe("orders");
    expect(params.get("page")).toBe("3");
    expect(params.get("opage")).toBe("7");
  });

  test("switching back to the catalog drops ?tab= rather than writing the default", async () => {
    searchParamsString = "tab=orders";
    await mount();

    await act(() => latest?.setTab("catalog"));

    expect(pushedParams().get("tab")).toBeNull();
  });
});
