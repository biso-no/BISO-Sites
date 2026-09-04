import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import {
  findButton,
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";

// `next/navigation` and `next-intl` are external framework modules, not one of
// the app's own `@/lib/*` shared modules, so mocking them wholesale is fine —
// see CLAUDE.md's "never partially mock a shared lib module" rule, which this
// does not fall under.
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

// `mock.module` is process-wide, so this stub must expose every export the
// other suites in the same run reach for — `useLocale` included.
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

const { PaginationBar } = await import("./pagination-bar");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

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
  container = installedDom.document.createElement("div");
  installedDom.document.body.appendChild(container);
  root = createRoot(container as unknown as Element);
  await act(() => {
    root?.render(element);
  });
}

/** The pushed query string, parsed — substring assertions cannot tell
 * `page=4` apart from `opage=4`. */
function pushedParams(index = 0): URLSearchParams {
  const url = pushCalls[index];
  if (!url) {
    throw new Error(`No push at index ${index}`);
  }
  return new URLSearchParams(url.split("?")[1] ?? "");
}

test("goToPage writes the alternate page key and leaves the default one alone", async () => {
  searchParamsString = "tab=orders&page=4";
  await mount(
    createElement(PaginationBar, {
      page: 1,
      pageKey: "opage",
      size: 25,
      sizeKey: "osize",
      total: 300,
    })
  );

  await act(() => {
    findButton(container as unknown as TestNode, "2").click();
  });

  expect(pushCalls).toHaveLength(1);
  const params = pushedParams();
  expect(params.get("opage")).toBe("2");
  expect(params.get("page")).toBe("4");
});

test("changeSize resets the alternate page key, not the default one", async () => {
  searchParamsString = "page=4&opage=7&osize=25";
  await mount(
    createElement(PaginationBar, {
      page: 7,
      pageKey: "opage",
      size: 25,
      sizeKey: "osize",
      sizeSelectable: true,
      total: 300,
    })
  );

  const [select] = findElements(
    container as unknown as TestNode,
    (element) => element.tagName === "SELECT"
  );
  expect(select).toBeDefined();

  await act(() => {
    if (!select) {
      throw new Error("no size picker rendered");
    }
    select.value = "100";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });

  expect(pushCalls).toHaveLength(1);
  const params = pushedParams();
  expect(params.get("osize")).toBe("100");
  // The orders offset is invalidated by the new size…
  expect(params.get("opage")).toBeNull();
  // …but the catalog table's page is none of this bar's business.
  expect(params.get("page")).toBe("4");
});

// A stale `?page=` outlives the rows it pointed at — delete the only product on
// page 2 and `total` drops to 1 while the URL still says page 2. The bar must
// not strand the user there with an empty table and no way back.
test("offers a route back when the URL names a page past the last one", async () => {
  searchParamsString = "page=2";
  await mount(
    createElement(PaginationBar, {
      page: 2,
      size: 25,
      sizeSelectable: true,
      total: 1,
    })
  );

  await act(() => {
    findButton(container as unknown as TestNode, "1").click();
  });

  expect(pushCalls).toHaveLength(1);
  expect(pushedParams().get("page")).toBeNull();
});

test("offers a route back from an out-of-range page with no size picker", async () => {
  searchParamsString = "page=2";
  await mount(createElement(PaginationBar, { page: 2, size: 25, total: 1 }));

  await act(() => {
    findButton(container as unknown as TestNode, "1").click();
  });

  expect(pushCalls).toHaveLength(1);
  expect(pushedParams().get("page")).toBeNull();
});
