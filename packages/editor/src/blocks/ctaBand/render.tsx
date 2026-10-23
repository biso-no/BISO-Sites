"use client";

import { ButtonLink, isLiveButton } from "@/blocks/_v2";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { CtaBandBlock, LinkButton } from "@/editor/types";

const MAX_BUTTONS = 2;

interface Props {
  block: CtaBandBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CtaBandRender({ block, edit, onPatch }: Props) {
  // The site shows only buttons that can be clicked; the editor shows them all.
  const buttons = listOf<LinkButton>(block.buttons)
    .slice(0, MAX_BUTTONS)
    .filter((button) => edit || isLiveButton(button));
  return (
    <div className="grid @2xl:grid-cols-[1fr_auto] @2xl:items-end gap-6">
      <div className="flex min-w-0 flex-col gap-3 break-words">
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
          className="type-display-sm hyphens-auto break-words"
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
            <ButtonLink button={button} edit={edit} key={i} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
