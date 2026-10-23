import { beforeEach, describe, expect, test } from "bun:test";
import { useEditorStore } from "./store";
import { doc, section } from "./test-fixtures";

describe("store on the section tree", () => {
  beforeEach(() => {
    useEditorStore
      .getState()
      .setDoc(doc(section("s-1", "1-1", [["b-1"], ["b-2"]])));
    useEditorStore.setState({ insertTarget: null, selectedSectionId: null });
    useEditorStore.getState().select(null);
  });

  test("insertBlock with nothing selected appends a one-column section", () => {
    const id = useEditorStore.getState().insertBlock("stats");
    const { sections } = useEditorStore.getState().doc;
    expect(sections).toHaveLength(2);
    expect(sections[1].layout.columns).toBe("1");
    expect(sections[1].columns[0].blocks[0].id).toBe(id);
    expect(useEditorStore.getState().selection).toBe(id);
  });

  test("insertBlock uses and clears the pending insert target", () => {
    const s = useEditorStore.getState();
    s.setInsertTarget({ columnId: "s-1-c1" });
    const id = s.insertBlock("stats");
    expect(
      useEditorStore
        .getState()
        .doc.sections[0].columns[1].blocks.map((b) => b.id)
    ).toEqual(["b-2", id]);
    expect(useEditorStore.getState().insertTarget).toBeNull();
  });

  test("insertBlock goes after the selected block by default", () => {
    useEditorStore.getState().select("b-1");
    const id = useEditorStore.getState().insertBlock("stats");
    expect(
      useEditorStore
        .getState()
        .doc.sections[0].columns[0].blocks.map((b) => b.id)
    ).toEqual(["b-1", id]);
  });

  test("insertBlock with a stale target falls back to a new section", () => {
    const id = useEditorStore.getState().insertBlock("stats", {
      columnId: "gone",
    });
    expect(id).not.toBe("");
    expect(useEditorStore.getState().doc.sections).toHaveLength(2);
  });

  test("undo restores a cross-column move", () => {
    const before = structuredClone(useEditorStore.getState().doc.sections);
    useEditorStore.getState().moveBlock("b-1", { columnId: "s-1-c1" });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.sections).toEqual(before);
  });

  test("selecting a block and selecting a section exclude each other", () => {
    const s = useEditorStore.getState();
    s.select("b-1");
    s.selectSection("s-1");
    expect(useEditorStore.getState().selection).toBeNull();
    s.select("b-2");
    expect(useEditorStore.getState().selectedSectionId).toBeNull();
  });

  test("removing a section clears a selected block inside it", () => {
    useEditorStore.getState().select("b-2");
    useEditorStore.getState().removeSection("s-1");
    expect(useEditorStore.getState().selection).toBeNull();
  });

  test("removing the selected section clears the section selection", () => {
    useEditorStore.getState().selectSection("s-1");
    useEditorStore.getState().removeSection("s-1");
    expect(useEditorStore.getState().selectedSectionId).toBeNull();
  });
});
