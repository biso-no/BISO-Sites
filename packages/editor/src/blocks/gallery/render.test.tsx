import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { GalleryBlock } from "@/editor/types";
import { GalleryRender } from "./render";

const images = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    alt: `Photo ${i + 1}`,
    src: `https://example.com/${i + 1}.jpg`,
  }));

const block = (n: number, layout: GalleryBlock["layout"]): GalleryBlock => ({
  id: "g1",
  images: images(n),
  layout,
  type: "gallery",
});

const html = (b: GalleryBlock, edit = false) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(GalleryRender, { block: b, edit, onPatch: () => undefined })
    )
  );

const count = (s: string, needle: string) => s.split(needle).length - 1;

describe("GalleryRender", () => {
  test("collage with 5 images renders 5 chevron frames and the 3-column grid", () => {
    const out = html(block(5, "collage"));
    expect(count(out, 'class="chevron-frame')).toBe(5);
    expect(out).toContain("@2xl:grid-cols-[2fr_1fr_1fr]");
    expect(out).toContain("@2xl:grid-rows-2");
    expect(out).toContain("--ar:0.75");
  });

  test("the big tile derives its cut from its own height", () => {
    const out = html(block(5, "collage"));
    expect(out).toContain("pg-chevron-fill");
    expect(out).toContain("100cqh");
    expect(out).toContain("container-type:size");
    const css = readFileSync(
      join(import.meta.dir, "../../theme/sections.css"),
      "utf8"
    );
    expect(css).toContain(".pg-chevron-fill");
    expect(css).toContain("var(--cut-len, var(--cut))");
  });

  test("a gallery without an images array does not throw", () => {
    const bare = { id: "g", type: "gallery" } as unknown as GalleryBlock;
    expect(html(bare)).toBe('<section data-surface="deep"></section>');
  });

  test("collage shows at most 5 images", () => {
    expect(count(html(block(8, "collage")), 'class="chevron-frame')).toBe(5);
  });

  test("a short collage stays two columns, no row span", () => {
    const out = html(block(3, "collage"));
    expect(out).not.toContain("@2xl:grid-cols-[2fr_1fr_1fr]");
    expect(out).toContain("grid-cols-2");
  });

  test("grid layout", () => {
    const out = html(block(4, "grid"));
    expect(out).toContain("grid-cols-2 @lg:grid-cols-3");
  });

  test("row is a snap scroll strip", () => {
    const out = html(block(4, "row"));
    expect(out).toContain("overflow-x-auto");
    expect(out).toContain("snap-x");
  });

  test("no images on the site renders nothing", () => {
    expect(html(block(0, "collage"))).toBe(
      '<section data-surface="deep"></section>'
    );
  });

  test("no images in the editor shows a placeholder and the add control", () => {
    const out = html(block(0, "collage"), true);
    expect(out).toContain("bg-surface-sunken");
    expect(out).toContain("Add images");
  });

  test("edit mode adds remove buttons, the site does not", () => {
    expect(html(block(2, "grid"), true)).toContain('aria-label="Remove');
    expect(html(block(2, "grid"))).not.toContain("<button");
  });
});
