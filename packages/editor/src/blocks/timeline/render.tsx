"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { TimelineBlock, TimelineItem } from "@/editor/types";

interface Props {
  block: TimelineBlock;
  edit: boolean;
  onPatch: PatchFn;
}

type Entry = TimelineItem & { year?: string };

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function TimelineRender({ block, edit, onPatch }: Props) {
  const items = listOf<Entry>(block.items);
  const heading = text(block.heading);
  const update = (i: number, key: "label" | "text" | "title", v: string) =>
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
      <ol className="m-0 flex list-none flex-col gap-6 border-ink-accent border-l-2 p-0 pl-6">
        {items.map((item, i) => (
          <li className="flex min-w-0 flex-col gap-1" key={i}>
            <EditableText
              className="type-data text-ink-accent"
              edit={edit}
              onChange={(v) => update(i, "label", v)}
              tag="span"
              value={text(item.label) || text(item.year)}
            />
            {item.title || edit ? (
              <EditableText
                className="type-heading-card text-ink"
                edit={edit}
                onChange={(v) => update(i, "title", v)}
                tag="h3"
                value={text(item.title)}
              />
            ) : null}
            <EditableText
              className="type-body text-ink-muted"
              edit={edit}
              onChange={(v) => update(i, "text", v)}
              tag="p"
              value={text(item.text)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
