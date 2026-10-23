"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { HighlightsBlock } from "@/editor/types";

interface Props {
  block: HighlightsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function HighlightsRender({ block, edit, onPatch }: Props) {
  const items = listOf<HighlightsBlock["items"][number]>(block.items);
  return (
    <ul className="m-0 grid list-none gap-4 break-words p-0">
      {items.map((item, i) => (
        <li
          className="type-body min-w-0 border-ink-accent border-l-2 pl-4"
          key={i}
        >
          <EditableText
            edit={edit}
            onChange={(v) =>
              onPatch(
                "items",
                items.map((x, j) => (j === i ? { text: v } : x))
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
