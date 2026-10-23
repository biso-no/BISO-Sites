import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { section } from "@/editor/test-fixtures";
import type { Section } from "@/editor/types";
import { SectionView } from "./section-view";

const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
const html = (sec: Section, edit = false) =>
  renderToStaticMarkup(
    <SectionView edit={edit} renderBlock={(b) => <p>{b.id}</p>} section={sec} />
  );

test("a two-column section exposes its layout as data attributes", () => {
  const out = html(s);
  expect(out).toContain('class="pg-sec"');
  expect(out).toContain('data-columns="1-1"');
  expect(out).toContain('data-tablet="row"');
  expect(out.match(/class="pg-col"/g)).toHaveLength(2);
});

test("phone options and the anchor reach the markup", () => {
  const out = html({
    ...s,
    anchor: "aftermovie",
    layout: { ...s.layout, hideOnPhone: true, phoneReverse: true },
  });
  expect(out).toContain('id="aftermovie"');
  expect(out).toContain("data-phone-reverse");
  expect(out).toContain("data-hide-phone");
});

test("a block hidden on phones is marked", () => {
  const sec = structuredClone(s);
  sec.columns[0].blocks[0].hideOnPhone = true;
  expect(html(sec)).toContain(
    '<div class="pg-col__item" data-hide-phone=""><p>b-1</p>'
  );
});

const SECTION_HIDDEN_ON_PHONE =
  /<section class="pg-sec"[^>]*data-hide-phone=""/;

test("a section whose blocks are all hidden on phones is hidden there too", () => {
  // Otherwise the phone shows an empty band of section padding.
  const sec = structuredClone(s);
  sec.columns[0].blocks[0].hideOnPhone = true;
  expect(html(sec)).not.toMatch(SECTION_HIDDEN_ON_PHONE);
  sec.columns[1].blocks[0].hideOnPhone = true;
  expect(html(sec)).toMatch(SECTION_HIDDEN_ON_PHONE);
  // The editor's phone view still shows it, dimmed, through the same flag.
  expect(html(sec, true)).toMatch(SECTION_HIDDEN_ON_PHONE);
});

test("an empty section is not marked hidden on phones", () => {
  const empty = section("s-2", "1-1", [[], []]);
  expect(html(empty, true)).not.toMatch(SECTION_HIDDEN_ON_PHONE);
});

test("renders nothing for an empty section outside the editor", () => {
  const empty = section("s-2", "1-1", [[], []]);
  expect(html(empty)).toBe("");
  expect(html(empty, true)).toContain('class="pg-sec"');
});

const withBackground = (
  background: Section["layout"]["background"],
  backgroundImage?: Section["layout"]["backgroundImage"]
): Section => ({ ...s, layout: { ...s.layout, background, backgroundImage } });

const DEEP_SECTION = /<section class="pg-sec"[^>]*data-surface="deep"/;
const FIRST_SECTION = /<section class="pg-sec"[^>]*data-first=""/;
const PHOTO_BEFORE_GRID =
  /<img[^>]*class="pg-sec__photo"[^>]*\/?>\s*<div aria-hidden="true" class="pg-sec__scrim"><\/div>\s*<div class="pg-sec__grid">/;

test("light sections keep the page surface; a dark one opts into the deep aliases", () => {
  expect(html(withBackground("white"))).not.toContain("data-surface");
  expect(html(withBackground("tinted"))).not.toContain("data-surface");
  const dark = html(withBackground("dark"));
  expect(dark).toContain('data-background="dark"');
  expect(dark).toMatch(DEEP_SECTION);
});

test("a photo section puts its image and a scrim behind the grid", () => {
  const out = html(
    withBackground("photo", {
      alt: "Fadderullan på Storefjell",
      fileId: "f-1",
      src: "https://cdn.example/storefjell.jpg",
    })
  );
  expect(out).toContain('data-background="photo"');
  expect(out).toMatch(DEEP_SECTION);
  expect(out).toContain('alt="Fadderullan på Storefjell"');
  expect(out).toContain('src="https://cdn.example/storefjell.jpg"');
  expect(out).toMatch(PHOTO_BEFORE_GRID);
});

test("a photo with no alt text is marked decorative", () => {
  const out = html(
    withBackground("photo", { src: "https://cdn.example/storefjell.jpg" })
  );
  expect(out).toContain('alt=""');
});

test("a photo section without an image falls back to dark", () => {
  for (const sec of [
    withBackground("photo"),
    withBackground("photo", { src: "" }),
  ]) {
    const out = html(sec);
    expect(out).toContain('data-background="dark"');
    expect(out).toMatch(DEEP_SECTION);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("pg-sec__scrim");
  }
});

test("an image is ignored unless the background is Photo", () => {
  const out = html(
    withBackground("white", { src: "https://cdn.example/storefjell.jpg" })
  );
  expect(out).toContain('data-background="white"');
  expect(out).not.toContain("<img");
});

test("the first section is marked so it can clear the fixed nav", () => {
  const first = renderToStaticMarkup(
    <SectionView first renderBlock={(b) => <p>{b.id}</p>} section={s} />
  );
  expect(first).toMatch(FIRST_SECTION);
  expect(html(s)).not.toContain("data-first");
});
