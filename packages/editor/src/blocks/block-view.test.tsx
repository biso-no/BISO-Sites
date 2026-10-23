import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block } from "@/editor/types";
import { SURFACE } from "./_primitives/block-section";
import type {
  BlockLayout,
  ResolvedBackground,
} from "./_primitives/layout-types";
import { BlockView } from "./block-view";
import { allBlocks } from "./index";
import { registerBlock } from "./registry";

const noopPatch = () => undefined;

/** The legacy frame's classes: positioning and copy colour, no surface. */
const FRAME_CLASS = "pg-section relative text-foreground";
const FRAME_CLASS_ATTRIBUTE = /<div class="(pg-section\b[^"]*)"/;
const frameClass = (html: string) => FRAME_CLASS_ATTRIBUTE.exec(html)?.[1];

const render = (block: Block, background: ResolvedBackground) =>
  renderToStaticMarkup(
    <BlockView
      background={background}
      block={block}
      edit={false}
      onPatch={noopPatch}
    />
  );

const withLayout = (block: Block, layout?: BlockLayout): Block =>
  ({ ...block, layout }) as Block;

const emptyOf = (type: Block["type"]): Block => {
  const def = allBlocks().find((candidate) => candidate.type === type);
  if (!def) {
    throw new Error(`No block registered for ${type}`);
  }
  return def.empty();
};

/*
 * Sections own spacing and width now, so a block is only ever framed compact
 * and full-width; blocks rebuilt on BlockSection apply the same via classes.
 */
describe("every block sits in the section's frame", () => {
  // v2 blocks render bare: the section owns the surface and spacing.
  for (const def of allBlocks().filter((candidate) => !candidate.v2)) {
    test(`${def.type} takes the section's surface at compact spacing and full width`, () => {
      const html = render(def.empty(), "inverted");

      const framed =
        html.includes('data-background="inverted"') &&
        html.includes('data-spacing="compact"') &&
        html.includes('data-width="full"');
      const sectioned = html.includes(SURFACE.inverted);
      expect(framed || sectioned).toBe(true);
      if (framed) {
        // The section paints the surface; the frame only marks it.
        expect(frameClass(html)).toBe(FRAME_CLASS);
      }
    });
  }
});

describe("BlockView frame", () => {
  test("a block styled by blocks.css gets one compact, full-width frame", () => {
    const html = render(emptyOf("timeline"), "brand");

    expect(html.match(/class="pg-section\b/g)).toHaveLength(1);
    expect(html).toContain('data-background="brand"');
    expect(html).toContain('data-spacing="compact"');
    expect(html).toContain('data-width="full"');
    expect(frameClass(html)).toBe(FRAME_CLASS);
  });

  test("block.layout is ignored: the section owns spacing and width", () => {
    const html = render(
      withLayout(emptyOf("timeline"), {
        background: "brand",
        spacing: "spacious",
        width: "content",
      }),
      "muted"
    );

    expect(html).toContain('data-background="muted"');
    expect(html).toContain('data-spacing="compact"');
    expect(html).toContain('data-width="full"');
    expect(frameClass(html)).toBe(FRAME_CLASS);
  });

  test("a block that composes BlockSection is not framed twice", () => {
    const html = render(
      withLayout(emptyOf("cta"), { background: "inverted" }),
      "inverted"
    );

    expect(html).not.toContain("pg-section");
    expect(html).toContain("bg-inverted");
  });

  test("an unknown block type renders nothing", () => {
    const html = render(
      { id: "ghost", type: "not-a-block" } as unknown as Block,
      "default"
    );

    expect(html).toBe("");
  });
});

describe("v2 blocks", () => {
  test("a v2 definition renders bare, without the legacy frame", () => {
    const block = emptyOf("marquee");
    const original = allBlocks().find((d) => d.type === "marquee");
    if (!original) {
      throw new Error("marquee is not registered");
    }
    registerBlock({ ...original, Render: () => <p>bare</p>, v2: true });
    let html: string;
    try {
      html = render(block, "default");
    } finally {
      registerBlock(original);
    }
    expect(html).toBe("<p>bare</p>");
  });
});
