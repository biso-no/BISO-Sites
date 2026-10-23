import { allBlocks, normalizePageDoc, walkBlocks } from "@repo/editor/render";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RenderedPage } from "../../[...slug]/_components/rendered-page";
import { PAGE_BLOCKS_FEEDS, PAGE_BLOCKS_FIXTURE } from "./fixture";

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
  const v2Types = allBlocks().map((def) => def.type);
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
    <RenderedPage
      doc={PAGE_BLOCKS_FIXTURE}
      feeds={PAGE_BLOCKS_FEEDS}
      locale="no"
    />
  );
  expect(html).toContain("pg-header");
  expect(html.match(H1_OPEN)?.length).toBe(1);
  for (const def of allBlocks()) {
    expect(html, `no ${def.type} rendered`).toContain(
      `data-block="${def.type}"`
    );
  }
});

test("the fixture covers every background and column layout", () => {
  const html = renderToStaticMarkup(
    <RenderedPage
      doc={PAGE_BLOCKS_FIXTURE}
      feeds={PAGE_BLOCKS_FEEDS}
      locale="no"
    />
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
    <RenderedPage
      doc={PAGE_BLOCKS_FIXTURE}
      feeds={PAGE_BLOCKS_FEEDS}
      locale="no"
    />
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

test("two white sections meet, so the hairline between them shows", () => {
  const backgrounds = PAGE_BLOCKS_FIXTURE.sections.map(
    (s) => s.layout.background
  );
  const whitePair = backgrounds.some(
    (bg, i) => bg === "white" && backgrounds[i + 1] === "white"
  );
  expect(whitePair).toBe(true);
});

test("the four-column section carries a long word and an email address", () => {
  const narrow = PAGE_BLOCKS_FIXTURE.sections.find(
    (s) => s.layout.columns === "1-1-1-1"
  );
  const json = JSON.stringify(narrow);
  expect(json).toContain("Samarbeidspartnere");
  expect(json).toContain("communication.wintergames@biso.no");
});

test("a heading links somewhere, so the marker under its title shows", () => {
  const linked = walkBlocks(PAGE_BLOCKS_FIXTURE).filter(
    (block) => block.type === "heading" && block.link?.label && block.link.href
  );
  expect(linked.length).toBeGreaterThan(0);
});

test("every button on the gallery page links to an anchor on the page", () => {
  // Sample content: a real-looking sign-up URL would send a visitor to the
  // live events page as if this fair existed.
  const anchors = new Set(
    PAGE_BLOCKS_FIXTURE.sections.flatMap((s) => (s.anchor ? [s.anchor] : []))
  );
  const hrefs = [
    ...(PAGE_BLOCKS_FIXTURE.header?.buttons ?? []),
    ...walkBlocks(PAGE_BLOCKS_FIXTURE).flatMap((block) => {
      if (block.type === "buttons") {
        return block.items;
      }
      if (block.type === "ctaBand") {
        return block.buttons;
      }
      return [];
    }),
  ].map((button) => button.href);
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of hrefs) {
    expect(href.startsWith("#"), href).toBe(true);
    expect(anchors.has(href.slice(1)), href).toBe(true);
  }
});

test("the live blocks render their fixture feed rows", () => {
  const html = renderToStaticMarkup(
    <RenderedPage
      doc={PAGE_BLOCKS_FIXTURE}
      feeds={PAGE_BLOCKS_FEEDS}
      locale="no"
    />
  );
  expect(html).toContain("Karrieredagene: åpning og standrunde");
  expect(html).toContain("Programmet for Karrieredagene er klart");
  expect(html).toContain("Standvert");
});

test("partners, units and shop render their fixture feed rows", () => {
  const html = renderToStaticMarkup(
    <RenderedPage
      doc={PAGE_BLOCKS_FIXTURE}
      feeds={PAGE_BLOCKS_FEEDS}
      locale="no"
    />
  );
  expect(html).toContain("Fiktiv Bank");
  expect(html).toContain("Finansforeningen");
  expect(html).toContain("Karrieredagene-lue");
  expect(html).toContain("Utsolgt");
});
