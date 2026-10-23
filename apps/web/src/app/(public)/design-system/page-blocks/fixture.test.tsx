import { allBlocks, normalizePageDoc, walkBlocks } from "@repo/editor/render";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { PAGE_BLOCKS_FIXTURE } from "./fixture";

const H1_OPEN = /<h1[\s>]/g;
const SECTION_BACKGROUND =
  /<section class="pg-sec"[^>]*data-background="(\w+)"/g;
const SECTION_COLUMNS = /<section class="pg-sec"[^>]*data-columns="([\d-]+)"/g;
const GALLERY_BIG_TILE = /data-block="gallery"[\s\S]*pg-chevron-fill/;

function matches(html: string, re: RegExp): string[] {
  return [...html.matchAll(re)].map((m) => m[1] ?? "");
}

test("the fixture normalizes without loss", () => {
  const normalized = normalizePageDoc(PAGE_BLOCKS_FIXTURE);
  expect(normalized).toEqual(PAGE_BLOCKS_FIXTURE);
});

test("the fixture uses every v2 block type", () => {
  const v2Types = allBlocks()
    .filter((def) => def.v2)
    .map((def) => def.type);
  expect(v2Types.length).toBeGreaterThan(0);
  const used = new Set<string>();
  for (const block of walkBlocks(PAGE_BLOCKS_FIXTURE)) {
    used.add(block.type);
  }
  for (const type of v2Types) {
    expect(used.has(type), `fixture is missing a ${type} block`).toBe(true);
  }
});

test("the real page renders the header and every v2 block", () => {
  const html = renderToStaticMarkup(
    <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />
  );
  expect(html).toContain("pg-header");
  expect(html.match(H1_OPEN)?.length).toBe(1);
  for (const def of allBlocks().filter((d) => d.v2)) {
    expect(html, `no ${def.type} rendered`).toContain(
      `data-block="${def.type}"`
    );
  }
});

test("the fixture covers every background and column layout", () => {
  const html = renderToStaticMarkup(
    <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />
  );
  expect(new Set(matches(html, SECTION_BACKGROUND))).toEqual(
    new Set(["white", "tinted", "dark", "photo"])
  );
  expect(new Set(matches(html, SECTION_COLUMNS))).toEqual(
    new Set(["1", "1-1", "2-1", "1-2", "1-1-1", "1-1-1-1"])
  );
});

test("the collage is big enough to render its big tile", () => {
  // The big tile (and its exact-cut rule) appears only at five images.
  const html = renderToStaticMarkup(
    <RenderedPage doc={PAGE_BLOCKS_FIXTURE} feeds={{}} locale="no" />
  );
  expect(html).toMatch(GALLERY_BIG_TILE);
});

test("every content image has alt text", () => {
  const alts: string[] = [PAGE_BLOCKS_FIXTURE.header?.media?.alt ?? ""];
  for (const block of walkBlocks(PAGE_BLOCKS_FIXTURE)) {
    if (block.type === "image") {
      alts.push(block.alt);
    }
    if (block.type === "gallery") {
      alts.push(...block.images.map((image) => image.alt ?? ""));
    }
  }
  for (const alt of alts) {
    expect(alt.trim().length).toBeGreaterThan(0);
  }
});
