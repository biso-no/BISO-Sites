import { expect, test } from "bun:test";
import { doc, section } from "@/editor/test-fixtures";
import {
  acceptsDrop,
  applyDrop,
  type DropAction,
  dragSourceOf,
  dropIndicator,
  dropTargetOf,
  resolveDrop,
} from "./drop";

const d = doc(
  section("s-1", "1-1", [["b-1", "b-2"], ["b-3"]]),
  section("s-2", "1", [["b-4"]])
);
const palette = { source: "palette", type: "stats" } as const;

test("palette onto a block inserts before it", () => {
  expect(resolveDrop(d, palette, { kind: "block", blockId: "b-3" })).toEqual({
    kind: "insert-block",
    type: "stats",
    target: { columnId: "s-1-c1", beforeBlockId: "b-3" },
  });
});

test("palette onto a column appends", () => {
  expect(
    resolveDrop(d, palette, { kind: "column", columnId: "s-2-c0" })
  ).toEqual({
    kind: "insert-block",
    type: "stats",
    target: { columnId: "s-2-c0" },
  });
});

test("palette onto a new-section zone starts a section", () => {
  expect(resolveDrop(d, palette, { kind: "new-section", index: 1 })).toEqual({
    kind: "insert-block-new-section",
    type: "stats",
    index: 1,
  });
});

test("moving down inside a column lands after the target", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-1" },
      { kind: "block", blockId: "b-2" }
    )
  ).toEqual({
    kind: "move-block",
    blockId: "b-1",
    target: { columnId: "s-1-c0" },
  });
});

test("moving up inside a column lands before the target", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-2" },
      { kind: "block", blockId: "b-1" }
    )
  ).toEqual({
    kind: "move-block",
    blockId: "b-2",
    target: { columnId: "s-1-c0", beforeBlockId: "b-1" },
  });
});

test("moving to another column lands before the target", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-1" },
      { kind: "block", blockId: "b-4" }
    )
  ).toEqual({
    kind: "move-block",
    blockId: "b-1",
    target: { columnId: "s-2-c0", beforeBlockId: "b-4" },
  });
});

test("dropping a block on itself does nothing", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-1" },
      { kind: "block", blockId: "b-1" }
    )
  ).toEqual({ kind: "none" });
});

test("sections reorder with array-move semantics", () => {
  expect(
    resolveDrop(
      d,
      { source: "section", sectionId: "s-1" },
      { kind: "section", sectionId: "s-2" }
    )
  ).toEqual({ kind: "move-section", sectionId: "s-1" });
  expect(
    resolveDrop(
      d,
      { source: "section", sectionId: "s-2" },
      { kind: "section", sectionId: "s-1" }
    )
  ).toEqual({ kind: "move-section", sectionId: "s-2", beforeSectionId: "s-1" });
});

test("sections and blocks only see their own drop zones", () => {
  expect(acceptsDrop("section", "column")).toBe(false);
  expect(acceptsDrop("block", "section")).toBe(false);
  expect(acceptsDrop("palette", "new-section")).toBe(true);
});

test("no target, no action", () => {
  expect(resolveDrop(d, palette, null)).toEqual({ kind: "none" });
});

// ── Beyond the brief: edges the canvas relies on ────────────────────────────

test("every source/target pairing follows the accept table", () => {
  for (const source of ["palette", "block"] as const) {
    expect(acceptsDrop(source, "block")).toBe(true);
    expect(acceptsDrop(source, "column")).toBe(true);
    expect(acceptsDrop(source, "new-section")).toBe(true);
    expect(acceptsDrop(source, "section")).toBe(false);
  }
  expect(acceptsDrop("section", "section")).toBe(true);
  expect(acceptsDrop("section", "new-section")).toBe(true);
  expect(acceptsDrop("section", "block")).toBe(false);
});

test("a block onto a column appends to it", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-1" },
      { kind: "column", columnId: "s-1-c1" }
    )
  ).toEqual({
    kind: "move-block",
    blockId: "b-1",
    target: { columnId: "s-1-c1" },
  });
});

test("a block dropped at the end of the column it already ends does nothing", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-2" },
      { kind: "column", columnId: "s-1-c0" }
    )
  ).toEqual({ kind: "none" });
});

test("moving down past a middle block lands before the next one", () => {
  const three = doc(section("s-1", "1", [["b-1", "b-2", "b-3"]]));
  expect(
    resolveDrop(
      three,
      { source: "block", blockId: "b-1" },
      { kind: "block", blockId: "b-2" }
    )
  ).toEqual({
    kind: "move-block",
    blockId: "b-1",
    target: { columnId: "s-1-c0", beforeBlockId: "b-3" },
  });
});

test("a block onto a new-section zone moves it into a new section", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "b-3" },
      { kind: "new-section", index: 2 }
    )
  ).toEqual({ kind: "move-block-new-section", blockId: "b-3", index: 2 });
});

test("unknown ids resolve to nothing", () => {
  expect(
    resolveDrop(
      d,
      { source: "block", blockId: "missing" },
      { kind: "block", blockId: "b-1" }
    )
  ).toEqual({ kind: "none" });
  expect(
    resolveDrop(d, palette, { kind: "block", blockId: "missing" })
  ).toEqual({ kind: "none" });
  expect(
    resolveDrop(d, palette, { kind: "column", columnId: "missing" })
  ).toEqual({ kind: "none" });
  expect(
    resolveDrop(
      d,
      { source: "section", sectionId: "missing" },
      { kind: "section", sectionId: "s-1" }
    )
  ).toEqual({ kind: "none" });
});

test("a target the source does not accept does nothing", () => {
  expect(
    resolveDrop(
      d,
      { source: "section", sectionId: "s-1" },
      { kind: "column", columnId: "s-2-c0" }
    )
  ).toEqual({ kind: "none" });
  expect(
    resolveDrop(d, palette, { kind: "section", sectionId: "s-1" })
  ).toEqual({ kind: "none" });
});

test("a section onto a new-section zone moves before that section, or to the end", () => {
  const three = doc(
    section("s-1", "1", [[]]),
    section("s-2", "1", [[]]),
    section("s-3", "1", [[]])
  );
  const s1 = { source: "section", sectionId: "s-1" } as const;
  expect(resolveDrop(three, s1, { kind: "new-section", index: 2 })).toEqual({
    kind: "move-section",
    sectionId: "s-1",
    beforeSectionId: "s-3",
  });
  expect(resolveDrop(three, s1, { kind: "new-section", index: 3 })).toEqual({
    kind: "move-section",
    sectionId: "s-1",
  });
  expect(
    resolveDrop(
      three,
      { source: "section", sectionId: "s-3" },
      { kind: "new-section", index: 0 }
    )
  ).toEqual({ kind: "move-section", sectionId: "s-3", beforeSectionId: "s-1" });
});

test("a section dropped beside itself does nothing", () => {
  const s1 = { source: "section", sectionId: "s-1" } as const;
  expect(resolveDrop(d, s1, { kind: "section", sectionId: "s-1" })).toEqual({
    kind: "none",
  });
  expect(resolveDrop(d, s1, { kind: "new-section", index: 0 })).toEqual({
    kind: "none",
  });
  expect(resolveDrop(d, s1, { kind: "new-section", index: 1 })).toEqual({
    kind: "none",
  });
});

test("dropTargetOf reads dnd-kit's droppable data", () => {
  expect(
    dropTargetOf({ kind: "block", blockId: "b-1", sortable: { index: 0 } })
  ).toEqual({ kind: "block", blockId: "b-1" });
  expect(dropTargetOf({ kind: "column", columnId: "c-1" })).toEqual({
    kind: "column",
    columnId: "c-1",
  });
  expect(dropTargetOf({ kind: "section", sectionId: "s-1" })).toEqual({
    kind: "section",
    sectionId: "s-1",
  });
  expect(dropTargetOf({ kind: "new-section", index: 2 })).toEqual({
    kind: "new-section",
    index: 2,
  });
  expect(dropTargetOf(undefined)).toBeNull();
  expect(dropTargetOf({ kind: "block" })).toBeNull();
  expect(dropTargetOf({ kind: "new-section", index: "2" })).toBeNull();
  expect(dropTargetOf({ source: "palette", type: "text" })).toBeNull();
});

test("dragSourceOf reads the palette, block and section drag data", () => {
  expect(dragSourceOf({ source: "palette", type: "text" })).toEqual({
    source: "palette",
    type: "text",
  });
  expect(dragSourceOf({ kind: "block", blockId: "b-1" })).toEqual({
    source: "block",
    blockId: "b-1",
  });
  expect(dragSourceOf({ kind: "section", sectionId: "s-1" })).toEqual({
    source: "section",
    sectionId: "s-1",
  });
  expect(dragSourceOf({ kind: "column", columnId: "c-1" })).toBeNull();
  expect(dragSourceOf(null)).toBeNull();
});

test("dropIndicator marks where the drop lands", () => {
  expect(
    dropIndicator(d, resolveDrop(d, palette, { kind: "block", blockId: "b-3" }))
  ).toEqual({ kind: "before-block", blockId: "b-3" });
  expect(
    dropIndicator(
      d,
      resolveDrop(d, palette, { kind: "column", columnId: "s-2-c0" })
    )
  ).toEqual({ kind: "column-end", columnId: "s-2-c0" });
  expect(
    dropIndicator(d, resolveDrop(d, palette, { kind: "new-section", index: 1 }))
  ).toEqual({ kind: "new-section", index: 1 });
  expect(
    dropIndicator(d, {
      kind: "move-section",
      sectionId: "s-2",
      beforeSectionId: "s-1",
    })
  ).toEqual({ kind: "new-section", index: 0 });
  expect(dropIndicator(d, { kind: "move-section", sectionId: "s-1" })).toEqual({
    kind: "new-section",
    index: 2,
  });
  expect(dropIndicator(d, { kind: "none" })).toBeNull();
});

test("applyDrop calls the matching store action", () => {
  const calls: unknown[][] = [];
  const store = {
    insertBlock: (...args: unknown[]) => {
      calls.push(["insertBlock", ...args]);
      return "new";
    },
    insertBlockInNewSection: (...args: unknown[]) => {
      calls.push(["insertBlockInNewSection", ...args]);
      return "new";
    },
    moveBlock: (...args: unknown[]) => {
      calls.push(["moveBlock", ...args]);
    },
    moveBlockToNewSection: (...args: unknown[]) => {
      calls.push(["moveBlockToNewSection", ...args]);
    },
    moveSection: (...args: unknown[]) => {
      calls.push(["moveSection", ...args]);
    },
    select: (...args: unknown[]) => {
      calls.push(["select", ...args]);
    },
  };
  const actions: DropAction[] = [
    { kind: "insert-block", type: "text", target: { columnId: "c-1" } },
    { kind: "insert-block-new-section", type: "text", index: 1 },
    { kind: "move-block", blockId: "b-1", target: { columnId: "c-2" } },
    { kind: "move-block-new-section", blockId: "b-1", index: 0 },
    { kind: "move-section", sectionId: "s-1", beforeSectionId: "s-2" },
    { kind: "none" },
  ];
  for (const action of actions) {
    applyDrop(action, store);
  }
  expect(calls).toEqual([
    ["insertBlock", "text", { columnId: "c-1" }],
    ["insertBlockInNewSection", "text", 1],
    ["select", "new"],
    ["moveBlock", "b-1", { columnId: "c-2" }],
    ["moveBlockToNewSection", "b-1", 0],
    ["moveSection", "s-1", "s-2"],
  ]);
});
