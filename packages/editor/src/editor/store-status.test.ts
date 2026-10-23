import { describe, expect, test } from "bun:test";
import { useEditorStore } from "./store";

describe("setStatus", () => {
  test("mirrors the publish state without adding an undo step", () => {
    // Publishing is not an edit. If it landed in history, the next Cmd+Z
    // would flip the page back to draft instead of undoing the last change.
    const store = useEditorStore.getState();
    store.setDoc({
      meta: {
        department: "",
        slug: "a",
        status: "draft",
        title: "A",
      },
      sections: [],
      version: 2,
    });
    store.setMeta("title", "B");
    const stepsBefore = useEditorStore.getState().past.length;

    useEditorStore.getState().setStatus("published");

    expect(useEditorStore.getState().doc.meta.status).toBe("published");
    expect(useEditorStore.getState().past.length).toBe(stepsBefore);
  });
});

describe("themePreview", () => {
  const PREVIEW = { accent: "#fecd45", dark: "#3b1d63" };
  const doc = {
    meta: { department: "", slug: "a", status: "draft" as const, title: "A" },
    sections: [],
    version: 2 as const,
  };
  const actions: [string, () => void][] = [
    ["setDoc", () => useEditorStore.getState().setDoc(doc)],
    ["setLocale", () => useEditorStore.getState().setLocale("en")],
    ["undo", () => useEditorStore.getState().undo()],
    ["redo", () => useEditorStore.getState().redo()],
  ];
  for (const [name, run] of actions) {
    test(`${name} ends a live preview`, () => {
      useEditorStore.getState().setDoc(doc);
      useEditorStore.getState().setMeta("title", "B");
      useEditorStore.getState().undo();
      useEditorStore.getState().setThemePreview(PREVIEW);
      run();
      expect(useEditorStore.getState().themePreview).toBeNull();
    });
  }
});
