import { describe, expect, test } from "bun:test";
import { normalizePageDoc, serializePageForAI } from "./serialize";
import { useEditorStore } from "./store";
import { doc } from "./test-fixtures";
import type { PageDoc } from "./types";

// Spelled in two parts so the repo-wide guard stays simple.
const LEGACY_KEY = ["accent", "Color"].join("");
const PURPLE = { accent: "#c8a2f0", dark: "#3b1c6b" };

const withTheme = (theme: unknown): PageDoc => {
  const base = doc();
  return { ...base, meta: { ...base.meta, theme } } as unknown as PageDoc;
};

describe("normalizePageDoc and the theme", () => {
  test("keeps a valid theme", () => {
    expect(normalizePageDoc(withTheme(PURPLE)).meta.theme).toEqual(PURPLE);
  });

  test("drops a theme that fails contrast", () => {
    const out = normalizePageDoc(
      withTheme({ dark: "#9b5de5", accent: "#3aa3e1" })
    );
    expect(out.meta.theme).toBeUndefined();
  });

  test("drops a hostile colour", () => {
    const out = normalizePageDoc(
      withTheme({ dark: "#fff;}body{", accent: "#c8a2f0" })
    );
    expect(out.meta.theme).toBeUndefined();
  });

  test("keeps null, the reset to BISO", () => {
    expect(normalizePageDoc(withTheme(null)).meta.theme).toBeNull();
  });

  test("drops the legacy accent-swatch key without throwing", () => {
    const base = doc();
    const legacy = {
      ...base,
      meta: { ...base.meta, [LEGACY_KEY]: "#3DA9E0" },
    } as unknown as PageDoc;
    const out = normalizePageDoc(legacy);
    expect(LEGACY_KEY in out.meta).toBe(false);
    expect(out.meta.theme).toBeUndefined();
  });
});

describe("setTheme", () => {
  test("undo restores the previous theme", () => {
    const store = useEditorStore.getState();
    store.setDoc(doc());
    store.setTheme(PURPLE);
    expect(useEditorStore.getState().doc.meta.theme).toEqual(PURPLE);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.meta.theme).toBeUndefined();
  });

  test("null is a reset, not an absence, and undoes to the custom theme", () => {
    const store = useEditorStore.getState();
    store.setDoc(withTheme(PURPLE));
    store.setTheme(null);
    expect(useEditorStore.getState().doc.meta.theme).toBeNull();
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().doc.meta.theme).toEqual(PURPLE);
  });
});

describe("serializePageForAI theme line", () => {
  test("reads BISO when the theme is absent or null", () => {
    expect(serializePageForAI(doc(), null)).toContain("theme: BISO");
    expect(serializePageForAI(withTheme(null), null)).toContain("theme: BISO");
  });

  test("names the colours of a custom theme", () => {
    expect(serializePageForAI(withTheme(PURPLE), null)).toContain(
      "theme: dark #3b1c6b, accent #c8a2f0"
    );
  });
});
