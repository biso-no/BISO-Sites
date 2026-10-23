import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CardsBlock } from "@/editor/types";
import { allBlocks } from "../index";
import { CardsRender } from "./render";

const VIEWPORT_VARIANT = /(?<![@\w])(sm|md|lg|xl):/;
const GLYPHS = /[★◆●▲→]/;

const base: CardsBlock = {
  columns: 3,
  id: "c1",
  items: [
    { body: "Body one", href: "/a", title: "One" },
    { body: "Body two", href: "javascript:alert(1)", title: "Two" },
    { body: "Body three", title: "Three" },
  ],
  layout: "grid",
  style: "bordered",
  type: "cards",
};

const html = (block: CardsBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(CardsRender, { block, edit, onPatch: () => undefined })
    )
  );

const classTokens = (markup: string) =>
  new Set(
    [...markup.matchAll(/class="([^"]*)"/g)].flatMap(([, c]) =>
      (c ?? "").split(/\s+/)
    )
  );

describe("CardsRender", () => {
  test("grid layout uses the container-query grid, no viewport variant", () => {
    const out = html(base);
    expect(classTokens(out).has("@3xl:grid-cols-3")).toBe(true);
    expect(classTokens(out).has("overflow-x-auto")).toBe(false);
    expect(out).not.toMatch(VIEWPORT_VARIANT);
  });

  test("row layout is a horizontal snap scroller", () => {
    const tokens = classTokens(html({ ...base, layout: "row" }));
    expect(tokens.has("overflow-x-auto")).toBe(true);
    expect(tokens.has("snap-x")).toBe(true);
  });

  test("a safe href renders an anchor, a javascript: href does not", () => {
    const out = html(base);
    expect(out).toContain('href="/a"');
    expect(out).not.toContain("javascript:");
    expect(out.match(/<a /g)).toHaveLength(1);
  });

  test("links are inert in the editor", () => {
    expect(html(base, true)).not.toContain("<a ");
  });

  test("bordered cards use the border and accent hover tokens", () => {
    const tokens = classTokens(html(base));
    for (const t of [
      "rounded-biso-md",
      "border",
      "border-edge",
      "p-5",
      "hover:border-ink-accent",
    ]) {
      expect(tokens.has(t)).toBe(true);
    }
  });

  test("renders no icon, glyph or icon container", () => {
    const out = html({
      ...base,
      items: [{ body: "b", icon: "★", title: "t" } as never],
    });
    expect(out).not.toMatch(GLYPHS);
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("<img");
    expect(out.toLowerCase()).not.toContain("icon");
  });

  test("the row scroller is a labelled, focusable region", () => {
    const out = html({ ...base, layout: "row" });
    expect(out).toContain('role="region"');
    expect(out).toContain('aria-label="Kort"');
    expect(out).toContain('tabindex="0"');
    expect(classTokens(out).has("focus-visible:ring-focus-ring")).toBe(true);
  });

  test("an image renders through the chevron frame", () => {
    const out = html({
      ...base,
      items: [
        { body: "b", image: { alt: "En bygning", src: "/x.png" }, title: "t" },
      ],
    });
    expect(out).toContain('alt="En bygning"');
  });
});

test("allBlocks() has cards and none of the four merged blocks", () => {
  const types: string[] = allBlocks().map((d) => d.type);
  expect(types).toContain("cards");
  for (const gone of [
    "featureGrid",
    "featuredCards",
    "linkTileGrid",
    "scrollRow",
  ]) {
    expect(types).not.toContain(gone);
  }
});
