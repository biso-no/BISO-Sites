"use client";

import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { HighlightsBlock } from "@/editor/types";

interface Props {
  block: HighlightsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function HighlightsRender({ block, edit, onPatch }: Props) {
  return (
    <ul className="m-0 grid list-none gap-4 hyphens-auto break-words p-0">
      {block.items.map((item, i) => (
        <li
          className="type-body min-w-0 border-ink-accent border-l-2 pl-4"
          key={i}
        >
          <EditableText
            edit={edit}
            onChange={(v) =>
              onPatch(
                "items",
                block.items.map((x, j) => (j === i ? { text: v } : x))
              )
            }
            tag="span"
            value={item.text}
          />
        </li>
      ))}
    </ul>
  );
}
