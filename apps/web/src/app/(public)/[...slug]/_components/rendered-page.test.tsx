import type { PageDoc } from "@repo/editor/render";
import { createElement } from "react";
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
    setState: () => undefined,
  },
}));

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

  const html = renderToStaticMarkup(createElement(RenderedPage, { doc }));

  expect(html).toMatch(BISO_SURFACE_CLASS);
  expect(html).toContain("--page-accent:#3DA9E0");
  expect(html).toContain('data-background="default"');
  expect(html).toContain('data-background="muted"');
});
