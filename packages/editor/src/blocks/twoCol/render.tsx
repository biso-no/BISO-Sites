"use client";

import type { TwoColBlock } from "@/editor/types";
import type { PatchFn } from "@/blocks/types";

interface Props { block: TwoColBlock; edit: boolean; onPatch: PatchFn; }

export function TwoColRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-twocol pg-block">
      <div className="pg-twocol__col">
        {edit ? (
          <p
            contentEditable suppressContentEditableWarning data-edit="1"
            onBlur={(e) => onPatch("left", e.currentTarget.textContent ?? "")}
          >{block.left}</p>
        ) : (
          <p>{block.left}</p>
        )}
      </div>
      <div className="pg-twocol__col">
        {edit ? (
          <p
            contentEditable suppressContentEditableWarning data-edit="1"
            onBlur={(e) => onPatch("right", e.currentTarget.textContent ?? "")}
          >{block.right}</p>
        ) : (
          <p>{block.right}</p>
        )}
      </div>
    </div>
  );
}
