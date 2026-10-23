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

test("renders nothing for an empty section outside the editor", () => {
  const empty = section("s-2", "1-1", [[], []]);
  expect(html(empty)).toBe("");
  expect(html(empty, true)).toContain('class="pg-sec"');
});
