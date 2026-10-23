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
