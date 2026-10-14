import { describe, expect, test } from "bun:test";
import type { PageDoc } from "@/editor/types";
import { autosaveSignature } from "./autosave-signature";

const doc = (status: PageDoc["meta"]["status"], title = "A"): PageDoc => ({
  blocks: [],
  meta: { accentColor: "#3DA9E0", department: "", slug: "a", status, title },
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
});
