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

// `next/link` is a framework module; a plain anchor is enough to exercise the
// click handling this component adds.
mock.module("next/link", () => ({
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & Record<string, unknown>) => createElement("a", props, children),
}));

const { FilterChipLink } = await import("./filter-chip-link");
const { ListParamsProvider, useListParams } = await import("./use-list-params");

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

function chip(): TestElement {
  const anchor = findElements(
    container as unknown as TestNode,
    (element) => element.tagName === "A"
  )[0];
  if (!anchor) {
    throw new Error("No chip rendered");
  }
  return anchor;
}

// The chip's href can only describe the committed URL. Clicking it while a
// debounced search push is still in flight used to navigate back to the
// pre-search URL, discarding the term the user had just typed.
test("merges its filter with a search write that has not committed yet", async () => {
  type SetParams = ReturnType<typeof useListParams>["setParams"];
  let fromSearch: SetParams | null = null;

  function Search() {
    fromSearch = useListParams().setParams;
    return null;
  }

  await mount(
    createElement(
      ListParamsProvider,
      null,
      createElement(Search),
      <FilterChipLink
        href="/departments?type=society"
        params={{ type: "society" }}
      >
        Societies
      </FilterChipLink>
    )
  );

  await act(() => {
    fromSearch?.({ q: "oslo" });
  });
  await act(() => {
    chip().click();
  });

  expect(pushCalls).toHaveLength(2);
  const second = new URLSearchParams(pushCalls[1]?.split("?")[1] ?? "");
  expect(second.get("type")).toBe("society");
  expect(second.get("q")).toBe("oslo");
});

test("keeps an href so the chip is still a real link", async () => {
  await mount(
    <FilterChipLink
      href="/departments?type=society"
      params={{ type: "society" }}
    >
      Societies
    </FilterChipLink>
  );

  expect(chip().getAttribute("href")).toBe("/departments?type=society");
});
