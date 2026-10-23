"use client";

import { cardGridClass } from "@/blocks/_v2/card-grid";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { StepGridBlock, StepGridItem } from "@/editor/types";

interface Props {
  block: StepGridBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function StepGridRender({ block, edit, onPatch }: Props) {
  const items = listOf<StepGridItem>(block.items);
  const heading = text(block.heading);
  const update = (i: number, key: "body" | "title", v: string) =>
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, [key]: v } : x))
    );
  return (
    <div className="flex flex-col gap-6 break-words">
      {edit || heading.trim() ? (
        <EditableText
          className="type-heading-section min-w-0 hyphens-auto break-words text-ink"
          edit={edit}
          onChange={(v) => onPatch("heading", v)}
          tag="h2"
          value={heading}
        />
      ) : null}
      <ol className={`${cardGridClass(3)} m-0 list-none p-0`}>
        {items.map((item, i) => (
          <li className="flex min-w-0 flex-col gap-2" key={i}>
            <span className="type-display-sm text-ink-accent">{i + 1}</span>
            <EditableText
              className="type-heading-card text-ink"
              edit={edit}
              onChange={(v) => update(i, "title", v)}
              tag="h3"
              value={text(item.title)}
            />
            <EditableText
              className="type-body text-ink-muted"
              edit={edit}
              onChange={(v) => update(i, "body", v)}
              tag="p"
              value={text(item.body)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
