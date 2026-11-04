import { afterEach, beforeEach, expect, test } from "bun:test";
import { checkTheme } from "@repo/shared/utils/page-theme";
import { useEditorStore } from "@/editor/store";
import { doc, section } from "@/editor/test-fixtures";
import { findBlock } from "@/editor/tree";
import type { TextBlock } from "@/editor/types";
import { applyToolCall, pageStateForTurn } from "./chat-panel";

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
  // A new turn on a page with no long body: no cut body is left to refuse.
  pageStateForTurn(doc(), null);
});

test("insert_block without afterBlockId appends at the end of the page", () => {
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

test("insert_block with afterBlockId goes after that block", () => {
  applyToolCall("insert_block", { afterBlockId: "b-2", type: "stats" });
  const [first] = columnIds();
  expect(first[1][0]).toBe("b-2");
  expect(first[1]).toHaveLength(2);
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
});

test("insert_block after a block that is gone appends at the end", () => {
  applyToolCall("insert_block", { afterBlockId: "gone", type: "stats" });
  const state = useEditorStore.getState();
  expect(state.doc.sections).toHaveLength(2);
  expect(state.insertTarget).toEqual({ columnId: "s-1-c1" });
});

test("insert_section adds a section with the given columns and returns its id", () => {
  const result = applyToolCall("insert_section", {
    background: "dark",
    columns: "1-1-1",
  });
  const { sections } = useEditorStore.getState().doc;
  expect(sections).toHaveLength(2);
  expect(sections[1].columns).toHaveLength(3);
  expect(sections[1].layout.background).toBe("dark");
  expect(result).toMatchObject({
    sectionId: sections[1].id,
    status: "applied",
  });
});

test("insert_section afterSectionId places it right after that section", () => {
  useEditorStore
    .getState()
    .setDoc(
      doc(section("s-1", "1", [["b-1"]]), section("s-2", "1", [["b-2"]]))
    );
  applyToolCall("insert_section", { afterSectionId: "s-1", columns: "1-1" });
  const ids = useEditorStore.getState().doc.sections.map((s) => s.id);
  expect(ids[0]).toBe("s-1");
  expect(ids[2]).toBe("s-2");
  expect(ids).toHaveLength(3);
});

test("insert_section after a missing section is a tool error", () => {
  const result = applyToolCall("insert_section", {
    afterSectionId: "gone",
    columns: "1",
  });
  expect(result.status).toBe("error");
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
});

test("insert_block into column 2 of a 1-1 section lands there", () => {
  applyToolCall("insert_block", {
    columnIndex: 1,
    sectionId: "s-1",
    type: "stats",
  });
  const [first] = useEditorStore.getState().doc.sections;
  expect(first.columns[0].blocks).toHaveLength(1);
  expect(first.columns[1].blocks).toHaveLength(2);
  expect(first.columns[1].blocks.at(-1)?.type).toBe("stats");
});

test("insert_block into a section defaults to its first column", () => {
  applyToolCall("insert_block", { sectionId: "s-1", type: "stats" });
  const [first] = useEditorStore.getState().doc.sections;
  expect(first.columns[0].blocks.at(-1)?.type).toBe("stats");
});

test("insert_block with a column out of range is a tool error, not a throw", () => {
  for (const columnIndex of [2, -1, 1.5]) {
    const result = applyToolCall("insert_block", {
      columnIndex,
      sectionId: "s-1",
      type: "stats",
    });
    expect(result.status).toBe("error");
  }
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
  expect(columnIds()[0]).toEqual([["b-1"], ["b-2"]]);
});

test("insert_block into a missing section is a tool error", () => {
  const result = applyToolCall("insert_block", {
    sectionId: "gone",
    type: "stats",
  });
  expect(result.status).toBe("error");
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
});

test("insert_block with a column but no section is a tool error", () => {
  const result = applyToolCall("insert_block", {
    columnIndex: 0,
    type: "stats",
  });
  expect(result.status).toBe("error");
});

test("sectionId new targets the section the last insert_section made", () => {
  applyToolCall("insert_section", { columns: "1-1" });
  applyToolCall("insert_block", {
    columnIndex: 1,
    sectionId: "new",
    type: "stats",
  });
  const last = useEditorStore.getState().doc.sections.at(-1);
  expect(last?.columns[1].blocks[0].type).toBe("stats");
});

const theme = () => useEditorStore.getState().doc.meta.theme;

test("set_theme with a failing dark writes nothing and suggests a shade", () => {
  const before = theme();
  const result = applyToolCall("set_theme", {
    accent: "#3aa3e1",
    dark: "#9b5de5",
  });
  expect(result.status).toBe("error");
  expect(String(result.message)).toContain("dark");
  const { dark } = checkTheme({ accent: "#3aa3e1", dark: "#9b5de5" });
  expect(dark.suggestion).not.toBeNull();
  expect(String(result.message)).toContain(
    `${(Math.floor(dark.ratio * 10) / 10).toFixed(1)}:1`
  );
  expect(String(result.message)).toContain("7:1");
  expect(String(result.message)).toContain(dark.suggestion as string);
  expect(theme()).toEqual(before);
});

test("set_theme with a passing pair sets it", () => {
  const result = applyToolCall("set_theme", {
    accent: "#3aa3e1",
    dark: "#001a35",
  });
  expect(result.status).toBe("applied");
  expect(theme()).toEqual({ accent: "#3aa3e1", dark: "#001a35" });
});

test("set_theme reset sets the theme to null", () => {
  applyToolCall("set_theme", { accent: "#3aa3e1", dark: "#001a35" });
  applyToolCall("set_theme", { reset: true });
  expect(theme()).toBeNull();
});

test("set_theme stores normalized lowercase hex", () => {
  applyToolCall("set_theme", { accent: " #3AA3E1 ", dark: "#001A35" });
  expect(theme()).toEqual({ accent: "#3aa3e1", dark: "#001a35" });
});

test("only reset: true resets; reset: false and non-objects are errors", () => {
  applyToolCall("set_theme", { accent: "#3aa3e1", dark: "#001a35" });
  for (const bad of [{ reset: false }, "reset", null, 5]) {
    expect(applyToolCall("set_theme", bad as never).status).toBe("error");
  }
  expect(theme()).toEqual({ accent: "#3aa3e1", dark: "#001a35" });
});

test("invalid section columns, background or block type never reach the store", () => {
  const before = useEditorStore.getState().doc;
  expect(applyToolCall("insert_section", { columns: "5" }).status).toBe(
    "error"
  );
  expect(
    applyToolCall("insert_section", { background: "neon", columns: "1" }).status
  ).toBe("error");
  expect(applyToolCall("insert_block", { type: "nope" }).status).toBe("error");
  expect(useEditorStore.getState().doc).toBe(before);
});

test("insert_section with a background is one undo step", () => {
  applyToolCall("insert_section", { background: "dark", columns: "1-1" });
  expect(useEditorStore.getState().doc.sections).toHaveLength(2);
  useEditorStore.getState().undo();
  expect(useEditorStore.getState().doc.sections).toHaveLength(1);
});

test("server-only tools are a neutral success", () => {
  expect(applyToolCall("list_blocks", {}).status).toBe("applied");
  expect(applyToolCall("generate_copy", {}).status).toBe("applied");
});

const bodyOf = (id: string): TextBlock["body"] =>
  (findBlock(useEditorStore.getState().doc, id)?.block as TextBlock).body;

test("set_prop inside a text block's HTML body is refused and keeps the body", () => {
  const before = bodyOf("b-1");
  expect(typeof before).toBe("string");
  const result = applyToolCall("set_prop", {
    id: "b-1",
    path: "body.0.text",
    value: "New heading",
  });
  expect(result.status).toBe("error");
  expect(String(result.message)).toContain(
    "Set the whole body as one HTML string"
  );
  expect(bodyOf("b-1")).toBe(before);
});

test("set_prop body sets the whole HTML body", () => {
  const result = applyToolCall("set_prop", {
    id: "b-1",
    path: "body",
    value: "<p>x</p>",
  });
  expect(result.status).toBe("applied");
  expect(bodyOf("b-1")).toBe("<p>x</p>");
});

test("set_prop body.0.text still edits a legacy array body", () => {
  useEditorStore
    .getState()
    .setProp("b-1", "body", [{ text: "Old", type: "h" }]);
  const result = applyToolCall("set_prop", {
    id: "b-1",
    path: "body.0.text",
    value: "Hei",
  });
  expect(result.status).toBe("applied");
  expect(bodyOf("b-1")).toEqual([{ text: "Hei", type: "h" }]);
});

// A body the turn's page state showed cut or not at all: a whole-body
// rewrite from it would lose the rest, so only the selected block's, whose
// full props held it whole, goes through.
const LONG_BODY = "<p>abcdefgh</p>".repeat(300);

/** A turn begun on the page with b-1's body `LONG_BODY` and `selected`. */
function longBodyTurn(selected: string | null) {
  const store = useEditorStore.getState();
  store.setProp("b-1", "body", LONG_BODY);
  pageStateForTurn(useEditorStore.getState().doc, selected);
}

test("set_prop body on a block whose body the turn saw cut is refused and keeps the body", () => {
  longBodyTurn("b-2");
  const result = applyToolCall("set_prop", {
    id: "b-1",
    path: "body",
    value: "<p>Only the start</p>",
  });
  expect(result.status).toBe("error");
  expect(String(result.message)).toContain("select the block");
  expect(bodyOf("b-1")).toBe(LONG_BODY);
});

test("set_prop body on the selected block is applied, though its body is long", () => {
  longBodyTurn("b-1");
  const result = applyToolCall("set_prop", {
    id: "b-1",
    path: "body",
    value: "<p>Rewritten</p>",
  });
  expect(result.status).toBe("applied");
  expect(bodyOf("b-1")).toBe("<p>Rewritten</p>");
});

test("set_prop body on a short unselected body is still applied", () => {
  longBodyTurn("b-1");
  const result = applyToolCall("set_prop", {
    id: "b-2",
    path: "body",
    value: "<p>Short</p>",
  });
  expect(result.status).toBe("applied");
  expect(bodyOf("b-2")).toBe("<p>Short</p>");
});
