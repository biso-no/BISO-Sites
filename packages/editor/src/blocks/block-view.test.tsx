import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Block } from "@/editor/types";
import { SPACING, WIDTH } from "./_primitives/block-section";
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
 * The Design panel sits under every block, so every block has to answer it.
 * Most blocks are still styled by blocks.css and never read `layout`; those
 * are framed by BlockView. Blocks rebuilt on BlockSection apply it themselves.
 */
describe("every block answers the Design panel", () => {
  const layout: BlockLayout = {
    background: "inverted",
    spacing: "compact",
    width: "prose",
  };

  for (const def of allBlocks()) {
    test(`${def.type} paints the chosen surface, spacing and width`, () => {
      const html = render(withLayout(def.empty(), layout), "inverted");

      expect(html).toContain("bg-inverted");
      const framed =
        html.includes('data-spacing="compact"') &&
        html.includes('data-width="prose"');
      const sectioned =
        html.includes(SPACING.compact) && html.includes(WIDTH.prose);
      expect(framed || sectioned).toBe(true);
    });
  }
});

describe("BlockView frame", () => {
  test("a block styled by blocks.css gets one frame carrying its layout", () => {
    const html = render(
      withLayout(emptyOf("text"), {
        background: "brand",
        spacing: "spacious",
        width: "content",
      }),
      "brand"
    );

    expect(html.match(/class="pg-section\b/g)).toHaveLength(1);
    expect(html).toContain('data-background="brand"');
    expect(html).toContain('data-spacing="spacious"');
    expect(html).toContain('data-width="content"');
    expect(html).toContain("bg-brand");
    expect(html).not.toContain("data-auto");
  });

  test("an untouched block shows the panel's defaults and stays automatic", () => {
    const html = render(withLayout(emptyOf("text")), "muted");

    expect(html).toContain('data-background="muted"');
    expect(html).toContain('data-spacing="normal"');
    expect(html).toContain('data-width="wide"');
    expect(html).toContain('data-auto=""');
    expect(html).toContain("bg-section");
  });

  test("an explicit Auto background is treated like no choice", () => {
    const html = render(
      withLayout(emptyOf("text"), { background: "auto" }),
      "default"
    );

    expect(html).toContain('data-auto=""');
    expect(html).toContain('data-background="default"');
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
