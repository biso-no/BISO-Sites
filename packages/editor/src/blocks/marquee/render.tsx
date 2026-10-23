"use client";

import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { MarqueeBlock } from "@/editor/types";

interface Props {
  block: MarqueeBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const MARQUEE_SEPARATOR_RE = /\s*·\s*/;
const BAND_CLASS =
  "pg-marquee w-full overflow-hidden border-edge border-y py-4";
const TRACK_CLASS =
  "pg-marquee__track type-display-sm flex shrink-0 items-center whitespace-nowrap uppercase text-ink";

export function MarqueeRender({ block, edit, onPatch }: Props) {
  const text = typeof block.text === "string" ? block.text : "";
  if (edit) {
    return (
      <div className={BAND_CLASS}>
        <EditableText
          className="type-display-sm m-0 min-h-8 px-6 text-ink uppercase"
          edit
          onChange={(v) => onPatch("text", v)}
          tag="p"
          value={text}
        />
      </div>
    );
  }
  const parts = text.split(MARQUEE_SEPARATOR_RE).filter((p) => p.trim());
  if (parts.length === 0) {
    return null;
  }
  const track = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className={TRACK_CLASS}>
      {parts.map((part, i) => (
        <span className="flex items-center" key={i}>
          <span className="px-6">{part}</span>
          <span aria-hidden="true" className="text-ink-accent">
            ·
          </span>
        </span>
      ))}
    </div>
  );
  return (
    <div className={`${BAND_CLASS} pg-marquee--live`}>
      <div className="pg-marquee__run flex w-max">
        {track(false)}
        {track(true)}
      </div>
    </div>
  );
}
