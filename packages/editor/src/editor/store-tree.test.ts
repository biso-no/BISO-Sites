import { beforeEach, describe, expect, test } from "bun:test";
import { emptyHeader } from "../header/empty-header";
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

  test("with a section selected, insertBlock fills its first empty column", () => {
    // Add section -> the picker selects the new section -> a palette click
    // must land in it, not in another new section at the end of the page.
    const s = useEditorStore.getState();
    const sectionId = s.insertSection("1-1", 0);
    s.selectSection(sectionId);
    const id = useEditorStore.getState().insertBlock("stats");
    const { sections } = useEditorStore.getState().doc;
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe(sectionId);
    expect(sections[0].columns.map((c) => c.blocks.map((b) => b.id))).toEqual([
      [id],
      [],
    ]);
    expect(useEditorStore.getState().selection).toBe(id);
  });

  test("with a full section selected, insertBlock appends to its last column", () => {
    useEditorStore.getState().selectSection("s-1");
    const id = useEditorStore.getState().insertBlock("stats");
    const { sections } = useEditorStore.getState().doc;
    expect(sections).toHaveLength(1);
    expect(sections[0].columns.map((c) => c.blocks.map((b) => b.id))).toEqual([
      ["b-1"],
      ["b-2", id],
    ]);
  });

  test("a pending insert target still wins over the selected section", () => {
    const s = useEditorStore.getState();
    s.selectSection("s-1");
    s.setInsertTarget({ beforeBlockId: "b-1", columnId: "s-1-c0" });
    const id = useEditorStore.getState().insertBlock("stats");
    expect(
      useEditorStore
        .getState()
        .doc.sections[0].columns[0].blocks.map((b) => b.id)
    ).toEqual([id, "b-1"]);
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

  test("setDoc keeps a selection that still exists", () => {
    useEditorStore.getState().select("b-2");
    useEditorStore
      .getState()
      .setDoc(doc(section("s-1", "1-1", [["b-1"], ["b-2"]])));
    expect(useEditorStore.getState().selection).toBe("b-2");
  });

  test("setDoc clears a selection the new doc lacks", () => {
    useEditorStore.getState().select("b-2");
    useEditorStore.getState().setInsertTarget({ columnId: "s-1-c1" });
    useEditorStore.getState().setDoc(doc(section("s-9", "1", [["b-9"]])));
    expect(useEditorStore.getState().selection).toBeNull();
    expect(useEditorStore.getState().insertTarget).toBeNull();
  });
});

describe("store and the page header", () => {
  beforeEach(() => {
    useEditorStore
      .getState()
      .setDoc(doc(section("s-1", "1-1", [["b-1"], ["b-2"]])));
    useEditorStore.setState({
      headerSelected: false,
      insertTarget: null,
      selectedSectionId: null,
      selection: null,
    });
  });

  test("addHeader adds an empty header titled after the page and selects it", () => {
    useEditorStore.getState().select("b-1");
    useEditorStore.getState().addHeader();
    const s = useEditorStore.getState();
    expect(s.doc.header).toEqual(emptyHeader("Test page"));
    expect(s.headerSelected).toBe(true);
    expect(s.selection).toBeNull();
    expect(s.selectedSectionId).toBeNull();
  });

  test("addHeader keeps an existing header and only selects it", () => {
    useEditorStore.getState().addHeader();
    useEditorStore.getState().setHeaderProp("title", "Kept");
    const before = useEditorStore.getState().past.length;
    useEditorStore.getState().select(null);
    useEditorStore.getState().addHeader();
    const s = useEditorStore.getState();
    expect(s.doc.header?.title).toBe("Kept");
    expect(s.past.length).toBe(before);
    expect(s.headerSelected).toBe(true);
  });

  test("selecting a block or a section clears the header selection", () => {
    const s = useEditorStore.getState();
    s.addHeader();
    s.select("b-1");
    expect(useEditorStore.getState().headerSelected).toBe(false);
    s.selectHeader();
    expect(useEditorStore.getState()).toMatchObject({
      headerSelected: true,
      selectedSectionId: null,
      selection: null,
    });
    s.selectSection("s-1");
    expect(useEditorStore.getState().headerSelected).toBe(false);
  });

  test("inserting a block selects it instead of the header", () => {
    const s = useEditorStore.getState();
    s.addHeader();
    s.insertBlock("stats");
    expect(useEditorStore.getState().headerSelected).toBe(false);
  });

  test("undo after setHeaderProp restores the title", () => {
    const s = useEditorStore.getState();
    s.addHeader();
    s.setHeaderProp("title", "X");
    expect(useEditorStore.getState().doc.header?.title).toBe("X");
    s.undo();
    expect(useEditorStore.getState().doc.header?.title).toBe("Test page");
    s.redo();
    expect(useEditorStore.getState().doc.header?.title).toBe("X");
  });

  test("removeHeader clears it and its selection; undo brings it back", () => {
    const s = useEditorStore.getState();
    s.addHeader();
    s.removeHeader();
    expect(useEditorStore.getState().doc.header).toBeUndefined();
    expect(useEditorStore.getState().headerSelected).toBe(false);
    s.undo();
    expect(useEditorStore.getState().doc.header?.title).toBe("Test page");
  });

  test("undoing addHeader drops the header and its selection", () => {
    const s = useEditorStore.getState();
    s.addHeader();
    s.undo();
    expect(useEditorStore.getState().doc.header).toBeUndefined();
    expect(useEditorStore.getState().headerSelected).toBe(false);
  });

  test("setDoc without a header clears the header selection", () => {
    useEditorStore.getState().addHeader();
    useEditorStore.getState().setDoc(doc(section("s-9", "1", [["b-9"]])));
    expect(useEditorStore.getState().headerSelected).toBe(false);
  });
});
