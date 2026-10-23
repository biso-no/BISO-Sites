"use client";

import { ButtonLink, isLiveButton } from "@/blocks/_v2";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import type { ButtonsBlock, LinkButton } from "@/editor/types";

interface Props {
  block: ButtonsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const MAX_BUTTONS = 3;

export function ButtonsRender({ block, edit }: Props) {
  // The site shows only buttons that can be clicked; the editor shows them
  // all, so an editor can see the one still missing its link.
  const shown = listOf<LinkButton>(block.items)
    .slice(0, MAX_BUTTONS)
    .filter((button) => edit || isLiveButton(button));
  return (
    <div
      className={
        block.align === "center"
          ? "flex flex-wrap justify-center gap-3"
          : "flex flex-wrap gap-3"
      }
    >
      {shown.map((button, i) => (
        <ButtonLink button={button} edit={edit} key={i} />
      ))}
    </div>
  );
}
