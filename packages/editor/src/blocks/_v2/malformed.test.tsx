import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block, PageDoc } from "@/editor/types";
import { allBlocks } from "../index";
import type { BlockDefinition } from "../types";

/*
 * Copilot output and seed scripts bypass the editor UI, so a stored block can
 * hold a string where a list belongs, nulls inside a list, or nothing at all.
 * Each v2 block's Render and Inspector must survive that on their own: these
 * call them directly, not through BlockView, whose error boundary would hide
 * a crash.
 */
const DOC: PageDoc = {
  meta: {
    department: "",
    slug: "x",
    status: "draft",
    title: "x",
  },
  sections: [],
  version: 2,
};

type Corrupt = (empty: Record<string, unknown>) => Record<string, unknown>;

const keep = (key: string) => key === "id" || key === "type";

const CORRUPTIONS: [string, Corrupt][] = [
  [
    'every prop is "oops"',
    (empty) =>
      Object.fromEntries(
        Object.keys(empty).map((key) => [key, keep(key) ? empty[key] : "oops"])
      ),
  ],
  [
    "every list holds junk",
    (empty) =>
      Object.fromEntries(
        Object.entries(empty).map(([key, value]) => [
          key,
          Array.isArray(value) ? [null, "x", 3] : value,
        ])
      ),
  ],
  ["every prop is missing", (empty) => ({ id: empty.id, type: empty.type })],
];

const v2Blocks = (): BlockDefinition[] => allBlocks();

const renderBlock = (def: BlockDefinition, block: Block, edit: boolean) =>
  renderToStaticMarkup(
    createElement(def.Render, {
      block: block as never,
      edit,
      onPatch: () => undefined,
    })
  );

const renderInspector = (def: BlockDefinition, block: Block) =>
  renderToStaticMarkup(
    createElement(def.Inspector, {
      block: block as never,
      doc: DOC,
      onPatch: () => undefined,
    })
  );

describe("a malformed v2 block renders instead of crashing the page", () => {
  test("there are v2 blocks to check", () => {
    expect(v2Blocks().length).toBeGreaterThan(10);
  });

  for (const def of v2Blocks()) {
    for (const [name, corrupt] of CORRUPTIONS) {
      test(`${def.type}: ${name}`, () => {
        const block = corrupt(
          def.empty() as unknown as Record<string, unknown>
        ) as unknown as Block;
        expect(() => renderBlock(def, block, false)).not.toThrow();
        expect(() => renderBlock(def, block, true)).not.toThrow();
        expect(() => renderInspector(def, block)).not.toThrow();
      });
    }
  }
});
