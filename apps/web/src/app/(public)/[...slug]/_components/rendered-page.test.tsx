import type { PageDoc } from "@repo/editor/render";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { RenderedPage } from "./rendered-page";

const BISO_SURFACE_CLASS = /class="[^"]*\bbiso-surface\b[^"]*"/;
const SECTION_TAGS = /<section [^>]*>/g;
const HEADER_THEN_SECTION =
  /<header class="pg-header[\s\S]*<section class="pg-sec"/;
const H1_OPEN = /<h1[\s>]/g;

// The real render barrel pulls in every block (and the editor's `@/` alias,
// which this app's vitest does not resolve), so it is replaced. SectionView,
// and the normalizer are the real ones, imported by path:
// they are what these tests are about. Only the blocks, the store and the feed
// provider are stand-ins.
vi.mock("@repo/editor/render", async () => ({
  SectionView: (
    await import(
      "../../../../../../../packages/editor/src/sections/section-view"
    )
  ).SectionView,
  normalizePageDoc: (
    await import("../../../../../../../packages/editor/src/editor/serialize")
  ).normalizePageDoc,
  PageHeaderView: (
    await import(
      "../../../../../../../packages/editor/src/header/page-header-view"
    )
  ).PageHeaderView,
  BlockView: ({ block }: { block: { id: string; text?: string } }) =>
    createElement("div", { "data-block": block.id }, block.text),
  useEditorStore: {
    setState: (patch: unknown) => seededState.push(patch),
  },
  PageFeedProvider: ({
    children,
    department,
    feeds,
    locale,
  }: {
    children: ReactNode;
    department: string;
    feeds?: Record<string, unknown[]>;
    locale: string;
  }) =>
    createElement(
      "div",
      {
        "data-feed-department": department,
        "data-feed-keys": Object.keys(feeds ?? {}).join(","),
        "data-feed-locale": locale,
      },
      children
    ),
}));

const seededState: unknown[] = [];

const META = {
  accentColor: "#3DA9E0",
  department: "biso",
  slug: "brand-surface",
  status: "published" as const,
  title: "Brand surface",
};

const LAYOUT = {
  align: "top",
  background: "white",
  columns: "1",
  hideOnPhone: false,
  phoneReverse: false,
  spacing: "normal",
  tablet: "row",
};

const LAYOUT_1_1 = { ...LAYOUT, columns: "1-1" };

function section(id: string, background: string, columns: string[][]) {
  return {
    columns: columns.map((ids, index) => ({
      blocks: ids.map((blockId) => ({
        id: blockId,
        text: `${blockId} quote`,
        type: "quote",
      })),
      id: `${id}-c${index}`,
    })),
    id,
    layout: { ...LAYOUT, background },
  };
}

function docOf(sections: unknown[], meta = META): PageDoc {
  return { meta, sections, version: 2 } as unknown as PageDoc;
}

test("mounts the public brand surface without dropping the page accent", () => {
  const doc = docOf([
    section("s-1", "white", [["first"]]),
    section("s-2", "tinted", [["second"]]),
  ]);

  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );

  expect(html).toMatch(BISO_SURFACE_CLASS);
  expect(html).toContain("--page-accent:#3DA9E0");
  // Each section carries its own background; blocks paint none.
  expect(html).toContain('data-background="white"');
  expect(html).toContain('data-background="tinted"');
});

test("renders a two-column section", () => {
  const doc = docOf([
    { ...section("s-1", "white", [["b-1"], ["b-2"]]), layout: LAYOUT_1_1 },
  ]);
  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );
  expect(html.match(/class="pg-col"/g)).toHaveLength(2);
  expect(html).toContain("b-1 quote");
});

test("renders an old-format document as an empty page", () => {
  const html = renderToStaticMarkup(
    createElement(RenderedPage, {
      doc: { blocks: [], meta: META } as unknown as PageDoc,
      locale: "no",
    })
  );
  expect(html).toContain("pg-page");
  expect(html).not.toContain("pg-sec");
});

test("hands the feed source to blocks through the provider, not the store", () => {
  const doc: PageDoc = {
    sections: [],
    version: 2,
    meta: {
      accentColor: "#3DA9E0",
      department: "25",
      slug: "english-page",
      status: "published",
      title: "English page",
    },
  };

  seededState.length = 0;
  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "en" })
  );

  // The provider is what auto-source blocks read. It must carry this page's
  // values, because zustand serves `getInitialState` as the SSR snapshot and a
  // store seeded during render never reaches the server pass.
  expect(html).toContain('data-feed-department="25"');
  expect(html).toContain('data-feed-locale="en"');

  // The store is still seeded for everything else that reads it.
  expect(seededState[0]).toMatchObject({ locale: "en" });
});

test("forwards the server-resolved feeds to the provider", () => {
  // The whole server-rendering path hangs off this prop: the page resolves the
  // feeds, this boundary is the only thing that can carry them to the blocks,
  // and a block whose feed never arrives silently renders "Loading\u2026".
  const doc: PageDoc = {
    sections: [],
    version: 2,
    meta: {
      accentColor: "#3DA9E0",
      department: "25",
      slug: "feed-page",
      status: "published",
      title: "Feed page",
    },
  };

  const html = renderToStaticMarkup(
    createElement(RenderedPage, {
      doc,
      feeds: { "events|25|no": [{ title: "Kickoff" }] },
      locale: "no",
    })
  );

  expect(html).toContain('data-feed-keys="events|25|no"');
});

const sectionTags = (html: string) => html.match(SECTION_TAGS) ?? [];

test("only the first section clears the fixed nav", () => {
  const doc = docOf([
    section("s-1", "white", [["first"]]),
    section("s-2", "dark", [["second"]]),
  ]);
  const tags = sectionTags(
    renderToStaticMarkup(createElement(RenderedPage, { doc, locale: "no" }))
  );
  expect(tags).toHaveLength(2);
  expect(tags[0]).toContain('data-first=""');
  expect(tags[1]).not.toContain("data-first");
});

test("an empty first section, which renders nothing, hands the nav clearance on", () => {
  const doc = docOf([
    section("s-0", "white", [[]]),
    section("s-1", "white", [["first"]]),
    section("s-2", "white", [["second"]]),
  ]);
  const tags = sectionTags(
    renderToStaticMarkup(createElement(RenderedPage, { doc, locale: "no" }))
  );
  expect(tags).toHaveLength(2);
  expect(tags[0]).toContain('data-first=""');
  expect(tags[1]).not.toContain("data-first");
});

test("a section pruned for an empty feed hands the nav clearance on", async () => {
  const { pruneEmptyFeedBlocks } = await import("@repo/editor/serialize");
  const events = section("s-0", "white", [[]]);
  (events as { columns: { blocks: unknown[] }[] }).columns[0].blocks = [
    { id: "ev", source: "auto", type: "events" },
  ];
  const doc = pruneEmptyFeedBlocks(
    docOf([events, section("s-1", "white", [["first"]])]),
    { "events|biso|no|3": [] },
    "no"
  );
  const tags = sectionTags(
    renderToStaticMarkup(createElement(RenderedPage, { doc, locale: "no" }))
  );
  expect(tags).toHaveLength(1);
  expect(tags[0]).toContain('data-first=""');
});

const HEADER = {
  buttons: [],
  crumbs: [],
  eyebrow: "BISO Oslo",
  lede: "Tre dager på Storefjell",
  title: "Vinterlekene",
  variant: "plain",
};

test("a page header comes before the sections and takes the nav clearance", () => {
  const doc = {
    ...docOf([
      section("s-1", "white", [["first"]]),
      section("s-2", "dark", [["second"]]),
    ]),
    header: HEADER,
  } as unknown as PageDoc;
  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );
  expect(html).toMatch(HEADER_THEN_SECTION);
  expect(html).toContain("Vinterlekene");
  expect(html.match(H1_OPEN)).toHaveLength(1);
  expect(html).not.toContain("data-first");
  // Rendered for visitors: nothing is editable.
  expect(html.toLowerCase()).not.toContain("contenteditable");
});

test("without a header the first section still clears the nav", () => {
  const doc = docOf([section("s-1", "white", [["first"]])]);
  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );
  expect(html).not.toContain("pg-header");
  expect(sectionTags(html)[0]).toContain('data-first=""');
});

test("a header with no title of its own shows the page title as the h1", () => {
  const doc = {
    ...docOf([section("s-1", "white", [["first"]])]),
    header: { ...HEADER, title: "" },
  } as unknown as PageDoc;
  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );
  expect(html.match(H1_OPEN)).toHaveLength(1);
  expect(html).toContain(">Brand surface</h1>");
});
