/**
 * Two ways a block edit can be structurally valid and still wreck a page.
 *
 * `set_prop` and `set_variant` both write straight into a document the public
 * site renders, so what the editor refuses matters as much as what it applies.
 * These are the two routes that got past the earlier guards.
 */

import { describe, expect, test } from "bun:test";
import type { PageDoc } from "@repo/api/page-builder";
import { createFakeBackend } from "../testing/index";
import { createPageService, propPathProblem } from "./pages";

const LINKS = {
  web: (path: string) => `https://biso.no${path}`,
  admin: (path: string) => `https://admin.biso.no${path}`,
};

function pages() {
  return createPageService(createFakeBackend({ tables: {} }), LINKS);
}

/** A hero with an existing `items` array — the shape `length` needs to bite. */
function doc(): PageDoc {
  return {
    meta: { slug: "home", title: "Home", status: "draft" },
    blocks: [
      {
        id: "b1",
        type: "hero",
        variant: "split",
        items: [{ label: "One" }, { label: "Two" }],
      },
    ],
  } as unknown as PageDoc;
}

describe("a prop path may not address an array's size", () => {
  test("`items.length` is refused", () => {
    // No numeric segment, so the array-index ceiling never sees it — and
    // `setProp` assigns `node.length = value`, which resizes the array.
    expect(propPathProblem("items.length")).not.toBeNull();
  });

  test("and so is a nested one", () => {
    expect(propPathProblem("columns.0.items.length")).not.toBeNull();
  });

  test("the refusal reaches the edit, which reports itself as not applied", () => {
    const { doc: next, outcomes } = pages().applyEdits(doc(), [
      {
        op: "set_prop",
        blockId: "b1",
        path: "items.length",
        value: 4_294_967_294,
      },
    ]);
    expect(outcomes[0]?.applied).toBe(false);
    // And the array is untouched, not resized.
    const block = next.blocks[0] as unknown as { items: unknown[] };
    expect(block.items).toHaveLength(2);
  });

  test("an ordinary prop ending in a different word still applies", () => {
    expect(propPathProblem("items.0.label")).toBeNull();
    const { outcomes } = pages().applyEdits(doc(), [
      { op: "set_prop", blockId: "b1", path: "items.0.label", value: "Edited" },
    ]);
    expect(outcomes[0]?.applied).toBe(true);
  });

  test("the numeric ceiling still holds", () => {
    expect(propPathProblem("items.4294967294")).not.toBeNull();
  });
});

describe("a variant must be one the block type declares", () => {
  test("a typo is refused rather than persisted", () => {
    const { doc: next, outcomes } = pages().applyEdits(doc(), [
      { op: "set_variant", blockId: "b1", variant: "splitt" },
    ]);
    expect(outcomes[0]?.applied).toBe(false);
    expect(outcomes[0]?.detail).toContain("split");
    const block = next.blocks[0] as unknown as { variant: string };
    expect(block.variant).toBe("split");
  });

  test("another block type's variant is refused", () => {
    // `banner` is a `cta` variant, not a `hero` one. Renderers read `variant`
    // directly, so this would render a hero with a piece missing.
    const { outcomes } = pages().applyEdits(doc(), [
      { op: "set_variant", blockId: "b1", variant: "banner" },
    ]);
    expect(outcomes[0]?.applied).toBe(false);
  });

  test("a declared variant still applies", () => {
    const { doc: next, outcomes } = pages().applyEdits(doc(), [
      { op: "set_variant", blockId: "b1", variant: "centered" },
    ]);
    expect(outcomes[0]?.applied).toBe(true);
    const block = next.blocks[0] as unknown as { variant: string };
    expect(block.variant).toBe("centered");
  });

  test("a block type with no declared variants refuses every value", () => {
    const target = {
      meta: { slug: "home", title: "Home", status: "draft" },
      blocks: [{ id: "t1", type: "text", variant: "" }],
    } as unknown as PageDoc;
    const { outcomes } = pages().applyEdits(target, [
      { op: "set_variant", blockId: "t1", variant: "anything" },
    ]);
    expect(outcomes[0]?.applied).toBe(false);
    expect(outcomes[0]?.detail).toContain("no variants");
  });

  test("an unknown block id is still reported as such", () => {
    const { outcomes } = pages().applyEdits(doc(), [
      { op: "set_variant", blockId: "nope", variant: "split" },
    ]);
    expect(outcomes[0]?.applied).toBe(false);
    expect(outcomes[0]?.detail).toContain("nope");
  });
});
