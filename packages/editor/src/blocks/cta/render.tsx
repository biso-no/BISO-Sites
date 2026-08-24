"use client";

import { Button } from "@repo/ui/components/ui/button";
import { BlockHeading, BlockSection } from "@/blocks/_primitives";
import type {
  BlockLayout,
  ResolvedBackground,
} from "@/blocks/_primitives/layout-types";
import type { PatchFn } from "@/blocks/types";
import type { CtaBlock } from "@/editor/types";

type CtaRenderBlock = CtaBlock & { layout?: BlockLayout };

interface Props {
  background: ResolvedBackground;
  block: CtaRenderBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const VARIANT_SURFACE: Record<
  NonNullable<CtaBlock["variant"]>,
  ResolvedBackground | null
> = {
  card: null,
  banner: "inverted",
  gradient: "brand",
};

export const resolveCtaBackground = (
  block: CtaRenderBlock,
  background: ResolvedBackground
): ResolvedBackground => {
  const explicitBackground = block.layout?.background;
  if (explicitBackground && explicitBackground !== "auto") {
    return background;
  }

  const variant = block.variant ?? "card";
  return VARIANT_SURFACE[variant] ?? background;
};

export const CtaRender = ({ background, block, edit, onPatch }: Props) => (
  <BlockSection
    background={resolveCtaBackground(block, background)}
    spacing={block.layout?.spacing}
    width={block.layout?.width ?? "content"}
  >
    <div className="text-center">
      <BlockHeading
        align="center"
        className="mb-0 lg:mb-0"
        level={2}
        title={block.title}
        titleProps={
          edit
            ? {
                contentEditable: true,
                "data-edit": "1",
                onBlur: (event) =>
                  onPatch("title", event.currentTarget.textContent ?? ""),
                suppressContentEditableWarning: true,
              }
            : undefined
        }
      />
      <div className="mt-8">
        {edit ? (
          <Button
            contentEditable
            data-edit="1"
            onBlur={(event) =>
              onPatch("label", event.currentTarget.textContent ?? "")
            }
            size="lg"
            suppressContentEditableWarning
            type="button"
          >
            {block.label}
          </Button>
        ) : (
          <Button asChild size="lg">
            <a href={block.url}>{block.label}</a>
          </Button>
        )}
      </div>
    </div>
  </BlockSection>
);
