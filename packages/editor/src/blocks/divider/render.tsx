"use client";

import type { PatchFn } from "@/blocks/types";
import type { DividerBlock } from "@/editor/types";

interface Props {
  block: DividerBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const MARGIN = {
  large: "my-12",
  medium: "my-8",
  small: "my-4",
} as const satisfies Record<DividerBlock["spacing"], string>;

export function DividerRender({ block }: Props) {
  return <hr className={`border-edge ${MARGIN[block.spacing]}`} />;
}
