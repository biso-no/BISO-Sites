import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { act, createElement, type ReactNode } from "react";
import type { Root } from "react-dom/client";
import {
  findElements,
  installReactDom,
  type TestElement,
  type TestNode,
} from "@/test/react-dom-harness";

// Pins the documents and news list pages: rows, search, the status filter,
// the empty states and the delete flow. Runs in its own process (see
// list-clients.test.ts): the two action modules are mocked.

interface DeleteResult {
  error?: string;
  success?: boolean;
}

const deleteDocument = mock((_id: string) =>
  Promise.resolve<DeleteResult>({ success: true })
);
const deleteNews = mock((_id: string) =>
  Promise.resolve<DeleteResult>({ success: true })
);
const toast = {
  error: mock((_m: string) => undefined),
  message: mock((_m: string) => undefined),
  success: mock((_m: string) => undefined),
};

mock.module("server-only", () => ({}));
mock.module("../_actions/documents", () => ({ deleteDocument }));
mock.module("../_actions/news", () => ({ deleteNews }));
mock.module("sonner", () => ({ toast }));
mock.module("next/navigation", () => ({
  usePathname: () => "/list",
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));
mock.module("next-intl", () => ({
  useLocale: () => "no",
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));
mock.module("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: ReactNode;
    href: string;
  }) => createElement("a", { ...rest, href }, children),
}));
mock.module("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) =>
    createElement("img", { alt, src }),
}));

const installedDom = installReactDom();
const { DocumentsListClient } = await import(
  "../documents/_components/documents-list-client"
);
const { NewsListClient } = await import("../news/_components/news-list-client");

const labels = {
  all: "All",
  delete: "Delete it",
  deleteConfirm: "Click again to delete",
  draft: "Draft",
  edit: "Edit it",
  empty: "Nothing yet",
  emptyDescription: "Add the first one",
  published: "Published",
  searchPlaceholder: "Search here",
};

const UPDATED = "2026-03-04T10:00:00.000Z";
const UPDATED_TEXT = new Date(UPDATED).toLocaleDateString();

function documentRow(id: string, fields: Record<string, unknown> = {}) {
  return {
    $id: id,
    $updatedAt: UPDATED,
    category: "campus-bylaws",
    description: null,
    file_size: 2048,
    scope: "campus",
    status: "published",
    title: `Doc ${id}`,
    version: "2",
    ...fields,
  };
}

function articleRow(id: string, fields: Record<string, unknown> = {}) {
  return {
    $id: id,
    $updatedAt: UPDATED,
    author: "Kari",
    image: null,
    status: "published",
    translation_refs: [
      {
        additional_fields: JSON.stringify({ category: "Sport" }),
        locale: "no",
        title: `Sak ${id}`,
      },
      { additional_fields: null, locale: "en", title: `Story ${id}` },
    ],
    ...fields,
  };
}

let createRoot: typeof import("react-dom/client")["createRoot"];
let root: Root | null = null;
let container: TestElement;

beforeAll(async () => {
  ({ createRoot } = await import("react-dom/client"));
});

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  root = null;
  installedDom.document.body.textContent = "";
  for (const fn of [deleteDocument, deleteNews, ...Object.values(toast)]) {
    fn.mockClear();
  }
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

const page = () => container as unknown as TestNode;
const text = () => container.textContent ?? "";

function links(prefix: string): TestElement[] {
  return findElements(
    page(),
    (element) =>
      element.tagName === "A" &&
      (element.getAttribute("href") ?? "").startsWith(prefix)
  );
}

/** Each row's title link (the first link to the item). */
function titles(prefix: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of links(prefix)) {
    const href = link.getAttribute("href") ?? "";
    if (!seen.has(href) && (link.textContent ?? "") !== "") {
      seen.add(href);
      out.push(link.textContent ?? "");
    }
  }
  return out;
}

/** The delete buttons, one per row, in order: the claret-tinted ones. */
function deleteButtons(): TestElement[] {
  return findElements(
    page(),
    (element) =>
      element.tagName === "BUTTON" &&
      ["rgba(107,30,30,0.08)", "#6b1e1e"].includes(
        String(element.style.background)
      )
  );
}

async function click(element: TestElement) {
  await act(async () => {
    element.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(label: string): TestElement {
  const found = findElements(
    page(),
    (element) => element.tagName === "BUTTON" && element.textContent === label
  )[0];
  if (!found) {
    throw new Error(`Button not found: ${label}`);
  }
  return found;
}

async function search(value: string) {
  const input = findElements(
    page(),
    (element) =>
      element.tagName === "INPUT" &&
      element.getAttribute("placeholder") === labels.searchPlaceholder
  )[0];
  if (!input) {
    throw new Error("No search input");
  }
  // As in user-detail-actions.cases: call the onChange React rendered.
  const key = Object.keys(input).find((k) => k.startsWith("__reactProps"));
  const props = key
    ? (input as unknown as Record<string, { onChange?: (e: unknown) => void }>)[
        key
      ]
    : undefined;
  await act(async () => {
    input.value = value;
    props?.onChange?.({ currentTarget: input, target: input });
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const documents = (rows: unknown[], pageNumber = 1) =>
  createElement(DocumentsListClient, {
    initialDocuments: rows as never,
    labels,
    page: pageNumber,
    total: rows.length,
  });

const news = (rows: unknown[], pageNumber = 1) =>
  createElement(NewsListClient, {
    initialArticles: rows as never,
    labels,
    page: pageNumber,
    total: rows.length,
  });

describe("documents list", () => {
  test("a row per document with its badges and details", async () => {
    await mount(
      documents([
        documentRow("d1"),
        documentRow("d2", {
          category: "other",
          file_size: null,
          scope: "national",
          status: "draft",
          version: null,
        }),
      ])
    );
    expect(titles("/documents/d")).toEqual(["Doc d1", "Doc d2"]);
    expect(text()).toContain("Campus");
    expect(text()).toContain("National");
    expect(text()).toContain("Campus Bylaws");
    expect(text()).toContain("2.0 KB");
    expect(text()).toContain(UPDATED_TEXT);
    // A category without a label and a missing size show as they are.
    expect(text()).toContain("other");
    expect(text()).toContain("—");
    const edit = links("/documents/d1").find(
      (link) => link.getAttribute("title") === labels.edit
    );
    expect(edit).toBeDefined();
    expect(deleteButtons().map((b) => b.getAttribute("title"))).toEqual([
      labels.delete,
      labels.delete,
    ]);
  });

  test("search matches the title or description; chips filter by status", async () => {
    await mount(
      documents([
        documentRow("d1", { title: "Statutes" }),
        documentRow("d2", { description: "about STATUTES", title: "Other" }),
        documentRow("d3", { status: "draft", title: "Draft rules" }),
      ])
    );
    await search("statutes");
    expect(titles("/documents/d")).toEqual(["Statutes", "Other"]);
    await search("");
    await click(button("Draft"));
    expect(titles("/documents/d")).toEqual(["Draft rules"]);
    await search("zzz");
    expect(text()).toContain("No matching documents");
  });

  test("an empty first page offers the first upload", async () => {
    await mount(documents([]));
    expect(text()).toContain(labels.empty);
    expect(text()).toContain(labels.emptyDescription);
    const upload = links("/documents/new")[0];
    expect(upload?.textContent).toBe("Upload first document");
  });

  test("delete asks first, then deletes on the second click", async () => {
    await mount(documents([documentRow("d1"), documentRow("d2")]));
    const [first] = deleteButtons();
    await click(first as TestElement);
    expect(toast.message.mock.calls).toEqual([[labels.deleteConfirm]]);
    expect(deleteDocument).not.toHaveBeenCalled();
    expect((deleteButtons()[0] as TestElement).style.background).toBe(
      "#6b1e1e"
    );
    expect((deleteButtons()[1] as TestElement).style.background).toBe(
      "rgba(107,30,30,0.08)"
    );

    await click(deleteButtons()[0] as TestElement);
    expect(deleteDocument.mock.calls).toEqual([["d1"]]);
    expect(toast.success.mock.calls).toEqual([["Document deleted"]]);
    expect((deleteButtons()[0] as TestElement).style.background).toBe(
      "rgba(107,30,30,0.08)"
    );
  });

  test("a refused delete shows the server's message and stays armed", async () => {
    deleteDocument.mockImplementationOnce(() =>
      Promise.resolve({ error: "Not allowed" })
    );
    await mount(documents([documentRow("d1")]));
    await click(deleteButtons()[0] as TestElement);
    await click(deleteButtons()[0] as TestElement);
    expect(toast.error.mock.calls).toEqual([["Not allowed"]]);
    expect(toast.success).not.toHaveBeenCalled();
    expect((deleteButtons()[0] as TestElement).style.background).toBe(
      "#6b1e1e"
    );
  });
});

describe("news list", () => {
  test("a row per article: title in the editor's language, category, author", async () => {
    await mount(
      news([
        articleRow("n1", { image: "https://img/x.png" }),
        articleRow("n2", {
          translation_refs: [
            { additional_fields: "{bad", locale: "en", title: "Only English" },
          ],
        }),
        articleRow("n3", { author: null, translation_refs: [] }),
      ])
    );
    expect(titles("/news/n")).toEqual([
      "Sak n1",
      "Only English",
      "adminPortal.news.fallback.untitled",
    ]);
    expect(text()).toContain("Sport");
    expect(text()).toContain("Kari");
    expect(text()).toContain(UPDATED_TEXT);
    const images = findElements(page(), (el) => el.tagName === "IMG");
    expect(images.map((img) => img.getAttribute("src"))).toEqual([
      "https://img/x.png",
    ]);
  });

  test("search matches the title; chips filter by status", async () => {
    await mount(
      news([
        articleRow("n1"),
        articleRow("n2", { status: "draft" }),
        articleRow("n3"),
      ])
    );
    await search("SAK N3");
    expect(titles("/news/n")).toEqual(["Sak n3"]);
    await search("");
    await click(button("Draft"));
    expect(titles("/news/n")).toEqual(["Sak n2"]);
    await search("zzz");
    expect(text()).toContain("adminPortal.news.noMatching");
  });

  test("an empty first page offers to write the first article", async () => {
    await mount(news([]));
    expect(text()).toContain(labels.empty);
    const create = links("/news/new")[0];
    expect(create?.textContent).toBe("adminPortal.news.create");
  });

  test("delete removes the article on the first click", async () => {
    await mount(news([articleRow("n1"), articleRow("n2")]));
    await click(deleteButtons()[1] as TestElement);
    expect(deleteNews.mock.calls).toEqual([["n2"]]);
    expect(toast.success.mock.calls).toEqual([
      ["adminPortal.news.deleteSuccess"],
    ]);
    expect(toast.message).not.toHaveBeenCalled();
  });

  test("a refused delete says so in the editor's language", async () => {
    deleteNews.mockImplementationOnce(() =>
      Promise.resolve({ error: "Not allowed" })
    );
    await mount(news([articleRow("n1")]));
    await click(deleteButtons()[0] as TestElement);
    expect(toast.error.mock.calls).toEqual([["adminPortal.news.deleteError"]]);
  });
});
