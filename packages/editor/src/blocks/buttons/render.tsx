"use client";

import { ButtonLink } from "@/blocks/_v2";
import type { PatchFn } from "@/blocks/types";
import type { ButtonsBlock } from "@/editor/types";

interface Props {
  block: ButtonsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function ButtonsRender({ block }: Props) {
  return (
    <div
      className={
        block.align === "center"
          ? "flex flex-wrap justify-center gap-3"
          : "flex flex-wrap gap-3"
      }
    >
      {block.items.slice(0, 3).map((button, i) => (
        <ButtonLink button={button} key={i} />
      ))}
    </div>
  );
}
