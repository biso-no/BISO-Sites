import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { normalizePageDoc } from "@/editor/serialize";
import type { Block, PageDoc } from "@/editor/types";
import { BlockView } from "./block-view";
import { allBlocks } from "./index";
import { registerBlock } from "./registry";

const noopPatch = () => undefined;

const render = (block: Block, edit = false) =>
  renderToStaticMarkup(
    <BlockView block={block} edit={edit} onPatch={noopPatch} />
  );

const emptyOf = (type: Block["type"]): Block => {
  const def = allBlocks().find((candidate) => candidate.type === type);
  if (!def) {
    throw new Error(`No block registered for ${type}`);
  }
  return def.empty();
};

describe("BlockView", () => {
  test("a block renders bare, tagged with its type, with no legacy frame", () => {
    const original = allBlocks().find((d) => d.type === "marquee");
    if (!original) {
      throw new Error("marquee is not registered");
    }
    registerBlock({ ...original, Render: () => <p>bare</p> });
    let html: string;
    try {
      html = render(emptyOf("marquee"));
    } finally {
      registerBlock(original);
    }
    expect(html).toBe(
      '<div data-block="marquee" style="display:contents"><p>bare</p></div>'
    );
  });

  test("no block is framed in the retired legacy section", () => {
    for (const def of allBlocks()) {
      const html = render(def.empty(), true);
      expect(html, def.type).not.toContain("pg-section");
      expect(html, def.type).not.toContain("data-spacing");
    }
  });
});

/*
 * Pages stored before the four cut blocks were removed may still hold them.
 * They must load, stay out of the public site's way, and be deletable in the
 * editor.
 */
describe("a stored block of a removed type", () => {
  const stored = {
    meta: { title: "Old page" },
    sections: [
      {
        columns: [
          {
            blocks: [
              {
                id: "p1",
                name: "Ada",
                role: "Lead",
                type: "profileHeader",
              },
              {
                columns: [{ body: "a" }, { body: "b" }],
                id: "t1",
                type: "twoCol",
              },
            ],
            id: "c1",
          },
        ],
        id: "s1",
        layout: {
          align: "top",
          background: "white",
          columns: "1",
          hideOnPhone: false,
          phoneReverse: false,
          spacing: "normal",
          tablet: "row",
        },
      },
    ],
    version: 2,
  } as unknown as PageDoc;

  const blocks = (): Block[] =>
    normalizePageDoc(stored).sections.flatMap((s) =>
      s.columns.flatMap((c) => c.blocks)
    );

  test("the document normalizes without throwing and keeps both blocks", () => {
    expect(() => normalizePageDoc(stored)).not.toThrow();
    expect(blocks().map((b) => b.type as string)).toEqual([
      "profileHeader",
      "twoCol",
    ]);
  });

  test("the site renders nothing for them", () => {
    for (const block of blocks()) {
      expect(render(block, false)).toBe("");
    }
  });

  test("the editor shows a placeholder naming the type, so it can be deleted", () => {
    for (const block of blocks()) {
      const html = render(block, true);
      expect(html).toContain("Unknown block");
      expect(html).toContain(block.type);
    }
  });
});
