"use client";

import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { StatsBlock } from "@/editor/types";

interface Props {
  block: StatsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function StatsRender({ block, edit, onPatch }: Props) {
  const update = (i: number, key: "label" | "num", value: string) =>
    onPatch(
      "items",
      block.items.map((x, j) => (j === i ? { ...x, [key]: value } : x))
    );
  return (
    <dl className="m-0 grid @sm:grid-cols-2 @xl:grid-cols-3 gap-6 border-edge border-t pt-6">
      {block.items.map((item, i) => (
        <div className="flex flex-col-reverse gap-1" key={i}>
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
