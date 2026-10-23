import { describe, expect, test } from "bun:test";
import { section, doc as treeDoc } from "@/editor/test-fixtures";
import type { PageDoc } from "@/editor/types";
import { autosaveSignature, shouldAutosave } from "./autosave-signature";

const doc = (status: PageDoc["meta"]["status"], title = "A"): PageDoc => ({
  meta: { accentColor: "#3DA9E0", department: "", slug: "a", status, title },
  sections: [],
  version: 2,
});

describe("autosaveSignature", () => {
  test("ignores the publish status", () => {
    // Publish and unpublish write the status themselves. A save triggered
    // by the mirrored status would bump the row's $updatedAt and make the
    // queued auto-translation give up as stale.
    expect(autosaveSignature(doc("draft"))).toBe(
      autosaveSignature(doc("published"))
    );
  });

  test("changes with any content or other meta edit", () => {
    expect(autosaveSignature(doc("draft"))).not.toBe(
      autosaveSignature(doc("draft", "B"))
    );
  });

  test("a page header edit is a new signature", () => {
    const a = treeDoc(section("s-1", "1", [["b-1"]]));
    const b: PageDoc = {
      ...structuredClone(a),
      header: {
        buttons: [],
        crumbs: [],
        eyebrow: "",
        lede: "",
        title: "Om oss",
        variant: "plain",
      },
    };
    expect(autosaveSignature(b)).not.toBe(autosaveSignature(a));
  });

  test("a section layout change is a new signature; a status change is not", () => {
    const a = treeDoc(section("s-1", "1", [["b-1"]]));
    const b = structuredClone(a);
    b.sections[0].layout.background = "dark";
    const c = structuredClone(a);
    c.meta.status = "published";
    expect(autosaveSignature(b)).not.toBe(autosaveSignature(a));
    expect(autosaveSignature(c)).toBe(autosaveSignature(a));
  });
});

describe("shouldAutosave", () => {
  const loaded = treeDoc(section("s-1", "1", [["b-1"]]));
  const hydrated = autosaveSignature(loaded);

  test("hydration alone saves nothing", () => {
    // Opening a page must not write it back (C11): the stored title and
    // campus would be overwritten, and /pages/new would create a row.
    expect(
      shouldAutosave(
        hydrated,
        autosaveSignature(structuredClone(loaded)),
        false
      )
    ).toBe(false);
  });

  test("nothing saves before the locale has been hydrated", () => {
    expect(shouldAutosave(undefined, hydrated, false)).toBe(false);
    expect(shouldAutosave(undefined, hydrated, true)).toBe(false);
  });

  test("a real change after hydration saves", () => {
    const edited = structuredClone(loaded);
    edited.sections[0].layout.background = "dark";
    expect(shouldAutosave(hydrated, autosaveSignature(edited), false)).toBe(
      true
    );
  });

  test("a mirrored publish status is not a change", () => {
    const published = structuredClone(loaded);
    published.meta.status = "published";
    expect(shouldAutosave(hydrated, autosaveSignature(published), false)).toBe(
      false
    );
  });

  test("once changed, returning to the hydrated state still saves", () => {
    // Undo back to the loaded page after a save has gone out must write the
    // undo too, or the stored page keeps the edit.
    expect(shouldAutosave(hydrated, hydrated, true)).toBe(true);
  });
});
