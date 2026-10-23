import { afterEach, beforeEach, expect, test } from "bun:test";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import { applyToolCall } from "./chat-panel";

const columnIds = () =>
  useEditorStore
    .getState()
    .doc.sections.map((s) => s.columns.map((c) => c.blocks.map((b) => b.id)));

beforeEach(() => {
  const store = useEditorStore.getState();
  store.setDoc(doc(section("s-1", "1-1", [["b-1"], ["b-2"]])));
  store.select("b-1");
  store.setInsertTarget({ columnId: "s-1-c1" });
});

afterEach(() => {
  useEditorStore.getState().setInsertTarget(null);
  useEditorStore.getState().select(null);
});

test("insert_block without afterId appends at the end of the page", () => {
  // As the tool description promises, whatever the user has selected or
  // pointed the palette at.
  applyToolCall("insert_block", { type: "stats" });
  const state = useEditorStore.getState();
  expect(state.doc.sections).toHaveLength(2);
  expect(state.doc.sections[1].columns[0].blocks[0].type).toBe("stats");
  expect(columnIds()[0]).toEqual([["b-1"], ["b-2"]]);
  // The user's pending target and selection are left alone.
  expect(state.insertTarget).toEqual({ columnId: "s-1-c1" });
  expect(state.selection).toBe("b-1");
});

test("insert_block with afterId goes after that block", () => {
  applyToolCall("insert_block", { afterId: "b-2", type: "stats" });
  const [first] = columnIds();
  expect(first[1][0]).toBe("b-2");
  expect(first[1]).toHaveLength(2);
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
});

test("insert_block after a block that is gone appends at the end", () => {
  applyToolCall("insert_block", { afterId: "gone", type: "stats" });
  const state = useEditorStore.getState();
  expect(state.doc.sections).toHaveLength(2);
  expect(state.insertTarget).toEqual({ columnId: "s-1-c1" });
});
