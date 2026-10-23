import type { PageDoc } from "@repo/editor/render";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { RenderedPage } from "./rendered-page";

const BISO_SURFACE_CLASS = /class="[^"]*\bbiso-surface\b[^"]*"/;

// The real render barrel pulls in every block (and the editor's `@/` alias,
// which this app's vitest does not resolve), so it is replaced. SectionView is
// the real one, imported by path: it is what these tests are about.
vi.mock("@repo/editor/render", async () => ({
  SectionView: (
    await import(
      "../../../../../../../packages/editor/src/sections/section-view"
    )
  ).SectionView,
  legacyBackground: (background: string) => background,
  normalizePageDoc: (doc: { sections?: unknown }) =>
    doc.sections ? doc : { ...doc, sections: [], version: 2 },
  BlockView: ({
    background,
    block,
  }: {
    background: string;
    block: { id: string; text?: string };
  }) =>
    createElement(
      "div",
      { "data-background": background, "data-block": block.id },
      block.text
    ),
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
  align: "start",
  background: "default",
  columns: "1",
  hideOnPhone: false,
  phoneReverse: false,
  spacing: "normal",
  tablet: "keep",
};

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
    section("s-1", "default", [["first"]]),
    section("s-2", "muted", [["second"]]),
  ]);

  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );

  expect(html).toMatch(BISO_SURFACE_CLASS);
  expect(html).toContain("--page-accent:#3DA9E0");
  expect(html).toContain('data-background="default"');
  expect(html).toContain('data-background="muted"');
});

test("renders a two-column section", () => {
  const doc = docOf([section("s-1", "default", [["b-1"], ["b-2"]])]);
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
