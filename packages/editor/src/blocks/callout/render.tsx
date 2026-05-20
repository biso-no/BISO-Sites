"use client";

import type { PatchFn } from "@/blocks/types";
import type { CalloutBlock } from "@/editor/types";

const TONE_ICONS: Record<CalloutBlock["tone"], string> = {
  info: "ℹ",
  warn: "⚠",
  tip: "✦",
};

interface Props {
  block: CalloutBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CalloutRender({ block, edit, onPatch }: Props) {
  const tone = block.tone ?? "info";
  return (
    <div className="pg-callout-wrap pg-block">
      <div className={`pg-callout pg-callout--${tone}`}>
        <div aria-hidden="true" className="pg-callout__ic">
          {TONE_ICONS[tone]}
        </div>
        <div className="pg-callout__body">
          {edit ? (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions lint/a11y/noStaticElementInteractions: contentEditable is the editor interaction surface.
            <b
              contentEditable
              data-edit="1"
              onBlur={(e) =>
                onPatch("title", e.currentTarget.textContent ?? "")
              }
              suppressContentEditableWarning
            >
              {block.title}
            </b>
          ) : (
            <b>{block.title}</b>
          )}
          {edit ? (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: contentEditable is the editor interaction surface.
            <p
              contentEditable
              data-edit="1"
              onBlur={(e) => onPatch("body", e.currentTarget.textContent ?? "")}
              suppressContentEditableWarning
            >
              {block.body}
            </p>
          ) : (
            <p>{block.body}</p>
          )}
        </div>
      </div>
    </div>
  );
}
