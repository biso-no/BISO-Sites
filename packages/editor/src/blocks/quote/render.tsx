"use client";

import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { QuoteBlock } from "@/editor/types";

interface Props {
  block: QuoteBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function QuoteRender({ block, edit, onPatch }: Props) {
  const showCaption = Boolean(block.author || block.role) || edit;
  return (
    <figure className="m-0 flex max-w-(--measure) flex-col gap-4 hyphens-auto break-words border-action border-l-4 pl-6">
      <blockquote className="type-display-sm m-0 text-ink">
        <EditableText
          edit={edit}
          onChange={(v) => onPatch("text", v)}
          tag="span"
          value={block.text}
        />
      </blockquote>
      {showCaption && (
        <figcaption className="flex flex-col gap-1">
          <EditableText
            className="type-heading-card text-ink"
            edit={edit}
            onChange={(v) => onPatch("author", v)}
            tag="span"
            value={block.author}
          />
          <EditableText
            className="type-body-sm text-ink-muted"
            edit={edit}
            onChange={(v) => onPatch("role", v)}
            tag="span"
            value={block.role}
          />
        </figcaption>
      )}
    </figure>
  );
}
