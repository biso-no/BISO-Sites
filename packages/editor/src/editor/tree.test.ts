import { describe, expect, test } from "bun:test";
import { doc, section } from "./test-fixtures";
import {
  defaultInsertTarget,
  findBlock,
  findColumn,
  findSection,
  targetAfterBlock,
  targetInSection,
  walkBlocks,
} from "./tree";

const d = doc(
  section("s-1", "1-1", [["b-1", "b-2"], ["b-3"]]),
  section("s-2", "1", [["b-4"]])
);

describe("tree", () => {
  test("walkBlocks reads sections, then columns, then blocks", () => {
    expect(walkBlocks(d).map((b) => b.id)).toEqual([
      "b-1",
      "b-2",
      "b-3",
      "b-4",
    ]);
  });
  test("findBlock locates a block in a second column", () => {
    const found = findBlock(d, "b-3");
    expect(found?.section.id).toBe("s-1");
    expect(found?.column.id).toBe("s-1-c1");
    expect(found?.blockIndex).toBe(0);
    expect(findBlock(d, "nope")).toBeNull();
  });
  test("findColumn and findSection", () => {
    expect(findColumn(d, "s-2-c0")?.section.id).toBe("s-2");
    expect(findColumn(d, "x")).toBeNull();
    expect(findSection(d, "s-2")?.index).toBe(1);
    expect(findSection(d, "x")).toBeNull();
  });
  test("targetAfterBlock points before the next block, or at the column end", () => {
    expect(targetAfterBlock(d, "b-1")).toEqual({
      beforeBlockId: "b-2",
      columnId: "s-1-c0",
    });
    expect(targetAfterBlock(d, "b-2")).toEqual({ columnId: "s-1-c0" });
    expect(targetAfterBlock(d, "missing")).toBeNull();
  });
  test("defaultInsertTarget follows the selection", () => {
    expect(defaultInsertTarget(d, "b-3")).toEqual({ columnId: "s-1-c1" });
    expect(defaultInsertTarget(d, null)).toBeNull();
  });
  test("targetInSection picks the first empty column, else the last", () => {
    const gaps = doc(section("s-9", "1-1-1", [["b-1"], [], []]));
    expect(targetInSection(gaps, "s-9")).toEqual({ columnId: "s-9-c1" });
    expect(targetInSection(d, "s-1")).toEqual({ columnId: "s-1-c1" });
    expect(targetInSection(d, "missing")).toBeNull();
  });
});
