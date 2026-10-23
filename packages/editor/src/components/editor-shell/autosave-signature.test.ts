import { describe, expect, test } from "bun:test";
import { section, doc as treeDoc } from "@/editor/test-fixtures";
import type { PageDoc } from "@/editor/types";
import { autosaveSignature } from "./autosave-signature";

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
