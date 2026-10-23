import { beforeEach, describe, expect, test } from "bun:test";
import { produce } from "immer";
import {
  duplicateBlock,
  duplicateSection,
  insertBlock,
  moveBlock,
  moveBlockToNewSection,
  moveSection,
  setProp,
  setSectionAnchor,
  setSectionLayout,
  slugifyAnchor,
} from "./operations";
import { doc, section } from "./test-fixtures";
import { findBlock, walkBlocks } from "./tree";
import type { PageDoc, TextBlock } from "./types";

let d: PageDoc;

beforeEach(() => {
  d = doc(
    section("s-1", "1-1", [["b-1", "b-2"], ["b-3"]]),
    section("s-2", "1", [["b-4"]])
  );
});

const ids = (document: PageDoc, columnId: string): string[] => {
  for (const s of document.sections) {
    const col = s.columns.find((c) => c.id === columnId);
    if (col) {
      return col.blocks.map((b) => b.id);
    }
  }
  return [];
};

describe("operations", () => {
  test("insertBlock places a block before another in a column", () => {
    const id = insertBlock(d, "stats", {
      beforeBlockId: "b-3",
      columnId: "s-1-c1",
    });
    expect(ids(d, "s-1-c1")).toEqual([id ?? "", "b-3"]);
  });
  test("insertBlock into a missing column changes nothing", () => {
    expect(insertBlock(d, "stats", { columnId: "nope" })).toBeNull();
    expect(walkBlocks(d)).toHaveLength(4);
  });
  test("moveBlock moves across sections to the column end", () => {
    moveBlock(d, "b-1", { columnId: "s-2-c0" });
    expect(ids(d, "s-1-c0")).toEqual(["b-2"]);
    expect(ids(d, "s-2-c0")).toEqual(["b-4", "b-1"]);
  });
  test("moveBlock reorders inside a column", () => {
    moveBlock(d, "b-2", { beforeBlockId: "b-1", columnId: "s-1-c0" });
    expect(ids(d, "s-1-c0")).toEqual(["b-2", "b-1"]);
  });
  test("shrinking columns keeps every block", () => {
    setSectionLayout(d, "s-1", { columns: "1" });
    expect(d.sections[0].columns).toHaveLength(1);
    expect(ids(d, d.sections[0].columns[0].id)).toEqual(["b-1", "b-2", "b-3"]);
  });
  test("growing columns adds empty columns with unique ids", () => {
    setSectionLayout(d, "s-2", { columns: "1-1-1" });
    const cols = d.sections[1].columns;
    expect(cols.map((c) => c.blocks.length)).toEqual([1, 0, 0]);
    expect(new Set(cols.map((c) => c.id)).size).toBe(3);
  });
  test("duplicateSection copies with fresh ids right after the original", () => {
    const copyId = duplicateSection(d, "s-1");
    expect(d.sections.map((s) => s.id)).toEqual(["s-1", copyId ?? "", "s-2"]);
    const copied = walkBlocks({ ...d, sections: [d.sections[1]] });
    expect(copied.map((b) => b.type)).toEqual(["text", "text", "text"]);
    expect(copied.some((b) => ["b-1", "b-2", "b-3"].includes(b.id))).toBe(
      false
    );
  });
  test("duplicateSection does not copy the anchor", () => {
    setSectionAnchor(d, "s-1", "intro");
    duplicateSection(d, "s-1");
    expect(d.sections[1].anchor).toBeUndefined();
    expect(d.sections[0].anchor).toBe("intro");
  });
  test("duplicateBlock works on an immer draft", () => {
    let copyId: string | null = null;
    const next = produce(d, (draft) => {
      copyId = duplicateBlock(draft, "b-1");
    });
    expect(ids(next, "s-1-c0")).toEqual(["b-1", copyId ?? "", "b-2"]);
    expect(copyId).not.toBe("b-1");
    expect(findBlock(next, copyId ?? "")?.block.type).toBe("text");
  });
  test("duplicateSection works on an immer draft", () => {
    let copyId: string | null = null;
    const next = produce(d, (draft) => {
      copyId = duplicateSection(draft, "s-1");
    });
    expect(next.sections.map((s) => s.id)).toEqual([
      "s-1",
      copyId ?? "",
      "s-2",
    ]);
    const copied = walkBlocks({ ...next, sections: [next.sections[1]] });
    expect(copied.map((b) => b.type)).toEqual(["text", "text", "text"]);
    expect(copied.some((b) => ["b-1", "b-2", "b-3"].includes(b.id))).toBe(
      false
    );
  });
  test("a block can start a new section", () => {
    const sectionId = moveBlockToNewSection(d, "b-3", 0);
    expect(d.sections[0].id).toBe(sectionId ?? "");
    expect(ids(d, d.sections[0].columns[0].id)).toEqual(["b-3"]);
    expect(ids(d, "s-1-c1")).toEqual([]);
  });
  test("moveSection puts a section before another, or at the end", () => {
    moveSection(d, "s-2", "s-1");
    expect(d.sections.map((s) => s.id)).toEqual(["s-2", "s-1"]);
    moveSection(d, "s-2");
    expect(d.sections.map((s) => s.id)).toEqual(["s-1", "s-2"]);
  });
  test("setProp reaches a block inside a column", () => {
    setProp(d, "b-3", "body.0.text", "Hei");
    expect((findBlock(d, "b-3")?.block as TextBlock).body[0].text).toBe("Hei");
  });
  test("anchors are slugified", () => {
    setSectionAnchor(d, "s-1", "Se Aftermovien!");
    expect(d.sections[0].anchor).toBe("se-aftermovien");
    expect(slugifyAnchor("Påmelding & billetter")).toBe("pamelding-billetter");
  });
  test("anchors keep accented letters as their plain form", () => {
    expect(slugifyAnchor("Café møte")).toBe("cafe-mote");
    expect(slugifyAnchor("Ærlig Økt på Ålesund")).toBe("aerlig-okt-pa-alesund");
    expect(slugifyAnchor("Señor Zürich")).toBe("senor-zurich");
    expect(slugifyAnchor("  --Se aftermovien--  ")).toBe("se-aftermovien");
    expect(slugifyAnchor("!!!")).toBe("");
  });
});
