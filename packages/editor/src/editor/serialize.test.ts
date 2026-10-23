import { describe, expect, test } from "bun:test";
import { DEFAULT_SECTION_LAYOUT } from "./sections";
import { fromJSON, normalizePageDoc, serializePageForAI } from "./serialize";
import { block, doc, section } from "./test-fixtures";
import type { PageDoc, SectionLayout } from "./types";

describe("normalizePageDoc", () => {
  test("an old flat document becomes an empty v2 page with its meta", () => {
    const d = doc();
    const old = { blocks: [block("b-9")], meta: d.meta } as unknown as PageDoc;
    expect(normalizePageDoc(old)).toEqual({
      meta: d.meta,
      sections: [],
      version: 2,
    });
  });

  test("missing layout fields take the defaults", () => {
    const partial = doc({
      ...section("s-1", "1", [["b-1"]]),
      layout: { columns: "1" } as SectionLayout,
    });
    expect(normalizePageDoc(partial).sections[0].layout).toEqual(
      DEFAULT_SECTION_LAYOUT
    );
  });

  test("a two-column layout with one stored column gets an empty second column", () => {
    const s = section("s-1", "1", [["b-1"]]);
    const n = normalizePageDoc(
      doc({ ...s, layout: { ...s.layout, columns: "1-1" } })
    );
    expect(n.sections[0].columns.map((c) => c.blocks.length)).toEqual([1, 0]);
  });

  test("extra columns merge into the last kept column", () => {
    const s = section("s-1", "1-1", [["b-1"], ["b-2"]]);
    const n = normalizePageDoc(
      doc({ ...s, layout: { ...s.layout, columns: "1" } })
    );
    expect(n.sections[0].columns).toHaveLength(1);
    expect(n.sections[0].columns[0].blocks.map((b) => b.id)).toEqual([
      "b-1",
      "b-2",
    ]);
  });

  test("fromJSON normalizes", () => {
    const d = doc(section("s-1", "1", [["b-1"]]));
    expect(fromJSON(JSON.stringify(d))).toEqual(d);
  });

  test("a section without a columns array renders as empty columns", () => {
    const d = doc(section("s-1", "1-1", [[], []]));
    const bad = { ...d.sections[0], columns: undefined };
    const n = normalizePageDoc({ ...d, sections: [bad] } as unknown as PageDoc);
    expect(n.sections[0].columns.map((c) => c.blocks.length)).toEqual([0, 0]);
    const str = { ...d.sections[0], columns: "nope" };
    const n2 = normalizePageDoc({
      ...d,
      sections: [str],
    } as unknown as PageDoc);
    expect(n2.sections[0].columns).toHaveLength(2);
  });

  test("a column without a blocks array becomes empty", () => {
    const d = doc(section("s-1", "1-1", [["b-1"], []]));
    const cols = [{ id: "x" }, { id: "y", blocks: "nope" }];
    const n = normalizePageDoc({
      ...d,
      sections: [{ ...d.sections[0], columns: cols }],
    } as unknown as PageDoc);
    expect(n.sections[0].columns.map((c) => c.blocks)).toEqual([[], []]);
  });

  test("non-object sections and columns are skipped", () => {
    const d = doc(section("s-1", "1-1", [["b-1"], ["b-2"]]));
    const s = d.sections[0];
    const n = normalizePageDoc({
      ...d,
      sections: [null, "x", { ...s, columns: [null, 5, s.columns[0]] }],
    } as unknown as PageDoc);
    expect(n.sections).toHaveLength(1);
    expect(n.sections[0].columns).toHaveLength(2);
    expect(n.sections[0].columns[0].blocks.map((b) => b.id)).toEqual(["b-1"]);
  });
});

describe("serializePageForAI", () => {
  test("the AI sees the section and column structure", () => {
    const out = serializePageForAI(
      doc(section("s-1", "1-1", [["b-1"], ["b-2"]])),
      "b-2"
    );
    expect(out).toContain("sections: 1");
    expect(out).toContain("Section 1 [s-1] columns=1-1 background=white");
    expect(out).toContain("  Column 2 [s-1-c1]");
    expect(out).toMatch(/\[b-2\] type=text.*← SELECTED/);
  });
});
