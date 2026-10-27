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

  test("undo and redo after Publish keep the page published", () => {
    // History steps were taken while the page was a draft. Restoring one
    // must not bring that status back: the editor would offer Publish for a
    // live page and hide Unpublish.
    const store = useEditorStore.getState();
    store.setDoc({
      meta: { department: "", slug: "a", status: "draft", title: "A" },
      sections: [],
      version: 2,
    });
    store.setMeta("title", "B");
    useEditorStore.getState().undo();
    useEditorStore.getState().setStatus("published");

    useEditorStore.getState().redo();
    expect(useEditorStore.getState().doc.meta.title).toBe("B");
    expect(useEditorStore.getState().doc.meta.status).toBe("published");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.meta.title).toBe("A");
    expect(useEditorStore.getState().doc.meta.status).toBe("published");
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

describe("server corrections never enter history", () => {
  const T = { accent: "#fecd45", dark: "#3b1d63" };
  const base = {
    meta: { department: "", slug: "a", status: "draft" as const, title: "A" },
    sections: [],
    version: 2 as const,
  };

  test("dropPageTheme removes the theme from the page and from every undo step", () => {
    const store = useEditorStore.getState();
    store.setDoc(base);
    store.setTheme(T);
    store.setMeta("title", "B");
    const steps = useEditorStore.getState().past.length;

    useEditorStore.getState().dropPageTheme(T);

    const state = useEditorStore.getState();
    expect("theme" in state.doc.meta).toBe(false);
    expect(state.past.length).toBe(steps);
    // Undoing the title edit must not bring back the theme the department
    // now owns: the next publish would copy it again.
    state.undo();
    expect(useEditorStore.getState().doc.meta.title).toBe("A");
    expect(useEditorStore.getState().doc.meta.theme).toBeUndefined();
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().doc.meta.theme).toBeUndefined();
  });

  test("dropPageTheme drops a reset too", () => {
    useEditorStore.getState().setDoc(base);
    useEditorStore.getState().setTheme(null);
    useEditorStore.getState().dropPageTheme(null);
    expect("theme" in useEditorStore.getState().doc.meta).toBe(false);
  });

  const U = { accent: "#fecd45", dark: "#0b3d2e" };

  test("dropPageTheme leaves a theme picked since that save or publish alone", () => {
    // T went out with a save; U was picked before the answer came back. The
    // answer is about T, so U, and every step, stays as it is.
    const store = useEditorStore.getState();
    store.setDoc(base);
    store.setTheme(T);
    store.setTheme(U);

    useEditorStore.getState().dropPageTheme(T);

    const state = useEditorStore.getState();
    expect(state.doc.meta.theme).toEqual(U);
    expect(state.past.at(-1)?.meta.theme).toEqual(T);
  });

  test("dropPageTheme drops only the steps that hold that theme", () => {
    const store = useEditorStore.getState();
    store.setDoc(base);
    store.setTheme(U);
    store.setTheme({ ...T, dark: T.dark.toUpperCase() });

    useEditorStore.getState().dropPageTheme(T);

    const state = useEditorStore.getState();
    expect("theme" in state.doc.meta).toBe(false);
    // The step that held U keeps it: undo shows what was picked then.
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.meta.theme).toEqual(U);
  });

  test("dropPageTheme with no theme sent changes nothing", () => {
    useEditorStore.getState().setDoc(base);
    useEditorStore.getState().setTheme(T);
    useEditorStore.getState().dropPageTheme(undefined);
    expect(useEditorStore.getState().doc.meta.theme).toEqual(T);
  });

  test("adoptStoredMeta takes the stored values where the sent ones still stand", () => {
    const store = useEditorStore.getState();
    store.setDoc(base);
    store.setMeta("title", "B");
    const steps = useEditorStore.getState().past.length;

    useEditorStore
      .getState()
      .adoptStoredMeta(
        { department: "", slug: "a" },
        { department: "dept-1", slug: "a-2" }
      );

    const state = useEditorStore.getState();
    expect(state.doc.meta.department).toBe("dept-1");
    expect(state.doc.meta.slug).toBe("a-2");
    expect(state.past.length).toBe(steps);
    state.undo();
    expect(useEditorStore.getState().doc.meta.title).toBe("A");
    expect(useEditorStore.getState().doc.meta.department).toBe("dept-1");
    expect(useEditorStore.getState().doc.meta.slug).toBe("a-2");
  });

  test("adoptStoredMeta keeps a value typed since the save was sent", () => {
    useEditorStore.getState().setDoc(base);
    useEditorStore.getState().setMeta("slug", "typed-since");
    useEditorStore.getState().adoptStoredMeta({ slug: "a" }, { slug: "a-2" });
    expect(useEditorStore.getState().doc.meta.slug).toBe("typed-since");
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.meta.slug).toBe("a-2");
  });
});
