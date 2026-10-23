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

const noopPatch = () => undefined;

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
  for (const def of allBlocks()) {
    test(`${def.type} paints the surface at compact spacing and full width`, () => {
      const html = render(def.empty(), "inverted");

      expect(html).toContain("bg-inverted");
      const framed =
        html.includes('data-spacing="compact"') &&
        html.includes('data-width="full"');
      const sectioned = html.includes(SURFACE.inverted);
      expect(framed || sectioned).toBe(true);
    });
  }
});

describe("BlockView frame", () => {
  test("a block styled by blocks.css gets one compact, full-width frame", () => {
    const html = render(emptyOf("text"), "brand");

    expect(html.match(/class="pg-section\b/g)).toHaveLength(1);
    expect(html).toContain('data-background="brand"');
    expect(html).toContain('data-spacing="compact"');
    expect(html).toContain('data-width="full"');
    expect(html).toContain("bg-brand");
  });

  test("block.layout is ignored: the section owns spacing and width", () => {
    const html = render(
      withLayout(emptyOf("text"), {
        background: "brand",
        spacing: "spacious",
        width: "content",
      }),
      "muted"
    );

    expect(html).toContain('data-background="muted"');
    expect(html).toContain('data-spacing="compact"');
    expect(html).toContain('data-width="full"');
    expect(html).toContain("bg-section");
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
