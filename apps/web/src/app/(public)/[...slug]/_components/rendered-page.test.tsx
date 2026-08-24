import type { PageDoc } from "@repo/editor/render";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { RenderedPage } from "./rendered-page";

const BISO_SURFACE_CLASS = /class="[^"]*\bbiso-surface\b[^"]*"/;

vi.mock("@repo/editor/render", () => ({
  getBlock: () => ({
    Render: ({ background }: { background: string }) =>
      createElement("div", { "data-background": background }),
  }),
  normalizePageDoc: (doc: PageDoc) => doc,
  resolveBackgrounds: () => ["default", "muted"],
  useEditorStore: {
    setState: (patch: unknown) => seededState.push(patch),
  },
  PageFeedProvider: ({
    children,
    department,
    locale,
  }: {
    children: ReactNode;
    department: string;
    locale: string;
  }) =>
    createElement(
      "div",
      { "data-feed-department": department, "data-feed-locale": locale },
      children
    ),
}));

const seededState: unknown[] = [];

test("mounts the public brand surface without dropping the page accent", () => {
  const doc: PageDoc = {
    blocks: [
      { id: "first", type: "text" },
      { id: "second", type: "text" },
    ] as PageDoc["blocks"],
    meta: {
      accentColor: "#3DA9E0",
      department: "biso",
      slug: "brand-surface",
      status: "published",
      title: "Brand surface",
    },
  };

  const html = renderToStaticMarkup(
    createElement(RenderedPage, { doc, locale: "no" })
  );

  expect(html).toMatch(BISO_SURFACE_CLASS);
  expect(html).toContain("--page-accent:#3DA9E0");
  expect(html).toContain('data-background="default"');
  expect(html).toContain('data-background="muted"');
});

test("hands the feed source to blocks through the provider, not the store", () => {
  const doc: PageDoc = {
    blocks: [],
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
