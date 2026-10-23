"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { StatItem, StatsBlock } from "@/editor/types";

interface Props {
  block: StatsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function StatsRender({ block, edit, onPatch }: Props) {
  const items = listOf<StatItem>(block.items);
  if (!edit && items.length === 0) {
    return null;
  }
  const update = (i: number, key: "label" | "num", value: string) =>
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, [key]: value } : x))
    );
  return (
    <dl className="m-0 grid @sm:grid-cols-2 @xl:grid-cols-3 gap-6 break-words border-edge border-t pt-6">
      {items.map((item, i) => (
        <div className="flex min-w-0 flex-col-reverse gap-1" key={i}>
          <dt className="type-body-sm text-ink-muted">
            <EditableText
              edit={edit}
              onChange={(v) => update(i, "label", v)}
              tag="span"
              value={item.label}
            />
          </dt>
          <dd className="type-data m-0 text-3xl text-ink-accent">
            <EditableText
              edit={edit}
              onChange={(v) => update(i, "num", v)}
              tag="span"
              value={item.num}
            />
          </dd>
        </div>
      ))}
    </dl>
  );
}
