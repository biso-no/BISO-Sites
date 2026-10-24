import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Everything between the stored document and the renderer is real here: the
// editor's normalizer and the feed resolver (`@/lib/data/page-feeds`). Only
// the Appwrite readers and the client renderer are stubbed.
const cachedPublishedPage = vi.hoisted(() => vi.fn());
const cachedPageEventsFeed = vi.hoisted(() => vi.fn());
const cachedDepartmentTheme = vi.hoisted(() => vi.fn());

// `@repo/editor/sanitize` opens with `import "server-only"`, which throws
// outside a react-server build.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/app/actions/locale", () => ({ getLocale: async () => "no" }));
vi.mock("@/lib/cookie-prefs", () => ({ SESSION_COOKIE: "session" }));
vi.mock("@repo/api/page-builder", () => ({ getPage: vi.fn() }));
vi.mock("@/lib/data/public-content", () => ({
  cachedPageDepartmentsFeed: vi.fn(async () => ({ departments: [] })),
  cachedPageEventsFeed,
  cachedPageJobsFeed: vi.fn(async () => []),
  cachedPageNewsFeed: vi.fn(async () => []),
  cachedPagePartnersFeed: vi.fn(async () => []),
  cachedDepartmentTheme,
  cachedPublishedPage,
  isPublishedPage: () => true,
}));
// The client renderer pulls in every block; the element's props are what
// these tests read.
vi.mock("./_components/rendered-page", () => ({ RenderedPage: () => null }));

import { PageThemeStyle } from "@/components/page-theme-style";
import DynamicPage, { generateMetadata } from "./page";

const META = {
  department: "25",
  slug: "old-page",
  status: "published",
  title: "Old page",
};

function published(doc: unknown) {
  return {
    doc,
    row: { status: "published" },
    translation: { is_published: true, title: "Old page" },
  };
}

type Rendered = ReactElement<{
  doc: { sections: { columns: { blocks: unknown[] }[] }[]; version: number };
  feeds: Record<string, unknown[]>;
}>;
type Tree = ReactElement<{
  children: [ReactElement<{ theme: unknown }>, Rendered];
}>;

const renderTree = async (slug: string) =>
  (await DynamicPage({
    params: Promise.resolve({ slug: [slug] }),
  })) as Tree;

// <><PageThemeStyle/><RenderedPage/></>: the style comes first.
const render = async (slug: string) =>
  (await renderTree(slug)).props.children[1];

describe("block page route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedPageEventsFeed.mockResolvedValue([{ title: "Kickoff" }]);
    cachedDepartmentTheme.mockResolvedValue(null);
  });

  it("renders an old flat document as an empty page instead of a 500", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        blocks: [{ id: "b-1", source: "auto", type: "events" }],
        meta: META,
      })
    );

    const page = await render("old-page");

    expect(page.props.doc).toEqual({ meta: META, sections: [], version: 2 });
    expect(page.props.feeds).toEqual({});
    expect(cachedPageEventsFeed).not.toHaveBeenCalled();
  });

  it("resolves feeds past a section stored without columns", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        meta: META,
        sections: [
          { id: "s-1", layout: {} },
          {
            columns: [
              {
                blocks: [null, { id: "b-1", source: "auto", type: "events" }],
                id: "c-1",
              },
            ],
            id: "s-2",
            layout: { columns: "1" },
          },
        ],
        version: 2,
      })
    );

    const page = await render("old-page");

    // The renderer gets the normalized document, not the stored one.
    expect(
      page.props.doc.sections.map((s) => s.columns.map((c) => c.blocks.length))
    ).toEqual([[0], [1]]);
    expect(page.props.feeds).toEqual({
      "events|25|no|3": [{ title: "Kickoff" }],
    });
  });

  it("returns no metadata title when the translation is published but has no document", async () => {
    cachedPublishedPage.mockResolvedValue({
      doc: null,
      row: { status: "published" },
      translation: { is_published: true, title: "Old page" },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata).toEqual({});
  });

  it("returns no metadata title for an unpublished translation", async () => {
    cachedPublishedPage.mockResolvedValue({
      doc: { meta: META, sections: [], version: 2 },
      row: { status: "published" },
      translation: { is_published: false, title: "Old page" },
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata).toEqual({});
  });

  it("titles the metadata of a published page with a document", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [], version: 2 })
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["old-page"] }),
    });

    expect(metadata.title).toBe("Old page | BISO");
  });
});

describe("block page route: empty live blocks", () => {
  const eventsSection = (id: string) => ({
    columns: [
      {
        blocks: [{ id: `b-${id}`, source: "auto", type: "events" }],
        id: `c-${id}`,
      },
    ],
    id,
    layout: { columns: "1" },
  });

  it("drops a section whose only block resolved to an empty feed", async () => {
    cachedPageEventsFeed.mockResolvedValue([]);
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [eventsSection("s-1")], version: 2 })
    );

    const page = await render("old-page");

    expect(page.props.doc.sections[0].columns[0].blocks).toEqual([]);
  });

  it("keeps the block when its feed has rows", async () => {
    cachedPageEventsFeed.mockResolvedValue([{ title: "Kickoff" }]);
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [eventsSection("s-1")], version: 2 })
    );

    const page = await render("old-page");

    expect(page.props.doc.sections[0].columns[0].blocks).toHaveLength(1);
  });
});

describe("block page route: rich text", () => {
  it("hands RenderedPage sanitized text-block HTML", async () => {
    // Rows saved before the save path sanitized, or written around the admin,
    // still hold whatever HTML they were given.
    cachedPublishedPage.mockResolvedValue(
      published({
        meta: META,
        sections: [
          {
            columns: [
              {
                blocks: [
                  {
                    body: [
                      { text: "<img src=x onerror=alert(1)>hei", type: "p" },
                      { text: '<a href="/om-oss">lenke</a>', type: "p" },
                    ],
                    id: "b-1",
                    type: "text",
                  },
                ],
                id: "c-1",
              },
            ],
            id: "s-1",
            layout: { columns: "1" },
          },
        ],
        version: 2,
      })
    );

    const page = await render("old-page");
    const [textBlock] = page.props.doc.sections[0].columns[0].blocks as {
      body: { text: string }[];
    }[];

    expect(textBlock.body.map((item) => item.text)).toEqual([
      "hei",
      '<a href="/om-oss">lenke</a>',
    ]);
  });
});

describe("block page route: page theme", () => {
  const DEPT_THEME = { theme_dark: "#3b1c6b", theme_accent: "#c8a2f0" };
  const DOC_THEME = { dark: "#0b3d2e", accent: "#8fe3b5" };

  beforeEach(() => {
    vi.clearAllMocks();
    cachedDepartmentTheme.mockResolvedValue(null);
  });

  it("a page bound to a department wears that department's theme, first in the tree", async () => {
    cachedDepartmentTheme.mockResolvedValue(DEPT_THEME);
    cachedPublishedPage.mockResolvedValue({
      ...published({
        meta: { ...META, theme: DOC_THEME },
        sections: [],
        version: 2,
      }),
      row: { department_id: "d-1", status: "published" },
    });

    const tree = await renderTree("old-page");
    const [style, body] = tree.props.children;

    expect(cachedDepartmentTheme).toHaveBeenCalledWith("d-1");
    expect(style.type).toBe(PageThemeStyle);
    expect(style.props.theme).toEqual({ dark: "#3b1c6b", accent: "#c8a2f0" });
    expect(body.props.doc).toBeDefined();
  });

  it("a bound page whose department row is missing renders BISO, not its doc theme", async () => {
    cachedDepartmentTheme.mockResolvedValue(null);
    cachedPublishedPage.mockResolvedValue({
      ...published({
        meta: { ...META, theme: DOC_THEME },
        sections: [],
        version: 2,
      }),
      row: { department_id: "d-gone", status: "published" },
    });

    const [style] = (await renderTree("old-page")).props.children;

    expect(cachedDepartmentTheme).toHaveBeenCalledWith("d-gone");
    expect(style.props.theme).toBeNull();
  });

  it("a failed department read renders BISO, not the doc theme", async () => {
    cachedDepartmentTheme.mockRejectedValue(new Error("appwrite down"));
    cachedPublishedPage.mockResolvedValue({
      ...published({
        meta: { ...META, theme: DOC_THEME },
        sections: [],
        version: 2,
      }),
      row: { department_id: "d-1", status: "published" },
    });

    const [style] = (await renderTree("old-page")).props.children;

    expect(style.props.theme).toBeNull();
  });

  it("a page without a department uses its own meta theme", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        meta: { ...META, theme: DOC_THEME },
        sections: [],
        version: 2,
      })
    );

    const [style] = (await renderTree("old-page")).props.children;

    expect(cachedDepartmentTheme).not.toHaveBeenCalled();
    expect(style.props.theme).toEqual(DOC_THEME);
  });

  it("a page with neither renders no theme", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [], version: 2 })
    );

    const [style] = (await renderTree("old-page")).props.children;

    expect(style.type).toBe(PageThemeStyle);
    expect(style.props.theme).toBeNull();
  });

  it("a failing stored theme renders BISO", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({
        meta: { ...META, theme: { dark: "#9b5de5", accent: "#c8a2f0" } },
        sections: [],
        version: 2,
      })
    );

    const [style] = (await renderTree("old-page")).props.children;

    expect(style.props.theme).toBeNull();
  });
});

describe("block page route: reserved project slugs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("404s a projects/ slug, whatever stands in the page table", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [], version: 2 })
    );

    await expect(
      DynamicPage({ params: Promise.resolve({ slug: ["projects", "x", "y"] }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(
      await generateMetadata({
        params: Promise.resolve({ slug: ["projects", "x", "y"] }),
      })
    ).toEqual({});
    expect(cachedPublishedPage).not.toHaveBeenCalled();
  });

  it("404s a case variant of the reserved prefix", async () => {
    cachedPublishedPage.mockResolvedValue(
      published({ meta: META, sections: [], version: 2 })
    );

    await expect(
      DynamicPage({
        params: Promise.resolve({ slug: ["Projects", "winter-games"] }),
      })
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(
      await generateMetadata({
        params: Promise.resolve({ slug: ["PROJECTS", "winter-games"] }),
      })
    ).toEqual({});
    expect(cachedPublishedPage).not.toHaveBeenCalled();
  });
});
