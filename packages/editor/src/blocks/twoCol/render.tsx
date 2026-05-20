"use client";

import type { PatchFn } from "@/blocks/types";
import type { TwoColBlock } from "@/editor/types";

const VARIANT_COLS: Record<string, string> = {
  equal: "1fr 1fr",
  leftWide: "2fr 1fr",
  rightWide: "1fr 2fr",
};

interface Props {
  block: TwoColBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function TwoColRender({ block, edit, onPatch }: Props) {
  const variant = block.variant ?? "equal";
  const cols = VARIANT_COLS[variant] ?? "1fr 1fr";
  return (
    <div
      className={`pg-twocol pg-twocol--${variant} pg-block`}
      style={{ gridTemplateColumns: cols }}
    >
      <div className="pg-twocol__col">
        {edit ? (
          <p
            contentEditable
            data-edit="1"
            onBlur={(e) => onPatch("left", e.currentTarget.textContent ?? "")}
            suppressContentEditableWarning
          >
            {block.left}
          </p>
        ) : (
          <p>{block.left}</p>
        )}
      </div>
      <div className="pg-twocol__col">
        {edit ? (
          <p
            contentEditable
            data-edit="1"
            onBlur={(e) => onPatch("right", e.currentTarget.textContent ?? "")}
            suppressContentEditableWarning
          >
            {block.right}
          </p>
        ) : (
          <p>{block.right}</p>
        )}
      </div>
    </div>
  );
}
