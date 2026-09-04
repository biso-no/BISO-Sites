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
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";

// `next/navigation` and `next-intl` are external framework modules, not the
// app's own `@/lib/*` shared modules, so mocking them wholesale is fine.
let searchParamsString = "";

mock.module("next/navigation", () => ({
  usePathname: () => "/benefits",
  useRouter: () => ({ push: () => undefined }),
  useSearchParams: () => new URLSearchParams(searchParamsString),
}));

// `mock.module` is process-wide, so this stub must expose every export the
// other suites in the same run reach for — `useLocale` included.
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

const { SearchToolbar } = await import("./search-toolbar");
const { UrlSearchToolbar } = await import("./url-search-toolbar");

const installedDom = installReactDom();
let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

beforeEach(() => {
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

function searchInput(): TestElement {
  const input = findElements(
    container as unknown as TestNode,
    (element) => element.tagName === "INPUT"
  )[0];
  if (!input) {
    throw new Error("No search input rendered");
  }
  return input;
}

const noop = () => {
  // Intentionally empty: these tests assert rendering, not callbacks.
};

// The toolbar seeds its own state on mount. A caller bound to URL state needs
// the input to keep following that state afterwards, so `value` has to win over
// the copy made at mount.
test("mirrors a controlled value that changed after mount", async () => {
  await mount(createElement(SearchToolbar, { onSearch: noop, value: "hello" }));
  expect(searchInput().value).toBe("hello");

  await act(() => {
    root?.render(
      createElement(SearchToolbar, { onSearch: noop, value: "world" })
    );
  });

  expect(searchInput().value).toBe("world");
});

test("leaves an uncontrolled caller seeding from defaultSearch alone", async () => {
  await mount(
    createElement(SearchToolbar, { defaultSearch: "seeded", onSearch: noop })
  );

  expect(searchInput().value).toBe("seeded");
});

// Browser Back restores `?q=`, and the results follow it. The visible term has
// to follow too, or the box describes a query the list is no longer showing.
test("shows the term restored in the URL by browser navigation", async () => {
  searchParamsString = "q=hello";
  await mount(createElement(UrlSearchToolbar));
  expect(searchInput().value).toBe("hello");

  searchParamsString = "q=restored";
  await act(() => {
    root?.render(createElement(UrlSearchToolbar));
  });

  expect(searchInput().value).toBe("restored");
});
