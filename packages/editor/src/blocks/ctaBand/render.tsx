"use client";

import { ButtonLink } from "@/blocks/_v2";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { CtaBandBlock } from "@/editor/types";

interface Props {
  block: CtaBandBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CtaBandRender({ block, edit, onPatch }: Props) {
  const buttons = block.buttons.slice(0, 2);
  return (
    <div className="grid @2xl:grid-cols-[1fr_auto] @2xl:items-end gap-6">
      <div className="flex flex-col gap-3">
        {edit || block.eyebrow ? (
          <EditableText
            className="type-label text-ink-accent"
            edit={edit}
            onChange={(v) => onPatch("eyebrow", v)}
            tag="p"
            value={block.eyebrow}
          />
        ) : null}
        <EditableText
          className="type-display-lg"
          edit={edit}
          onChange={(v) => onPatch("title", v)}
          tag="h2"
          value={block.title}
        />
        {edit || block.text ? (
          <EditableText
            className="type-body text-ink-muted"
            edit={edit}
            onChange={(v) => onPatch("text", v)}
            tag="p"
            value={block.text}
          />
        ) : null}
      </div>
      {buttons.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {buttons.map((button, i) => (
            <ButtonLink button={button} key={i} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
