"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import type { PatchFn } from "@/blocks/types";
import type { DividerBlock } from "@/editor/types";

interface Props {
  block: DividerBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export const MARGIN = {
  large: "my-12",
  medium: "my-8",
  small: "my-4",
} as const satisfies Record<DividerBlock["spacing"], string>;

export function DividerRender({ block }: Props) {
  const spacing = knownKey(MARGIN, block.spacing, "medium");
  return <hr className={`border-edge ${MARGIN[spacing]}`} />;
}
