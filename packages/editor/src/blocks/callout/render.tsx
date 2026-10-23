"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { CalloutBlock } from "@/editor/types";

const LABELS = {
  en: { info: "Info", tip: "Tip", warn: "Important" },
  no: { info: "Info", tip: "Tips", warn: "Viktig" },
} as const;

export const TONE_CLASS: Record<CalloutBlock["tone"], string> = {
  info: "text-ink-accent",
  tip: "text-success",
  warn: "text-warning",
};

interface Props {
  block: CalloutBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function CalloutRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const tone = knownKey(TONE_CLASS, block.tone, "info");
  const labels = locale === "en" ? LABELS.en : LABELS.no;
  return (
    <aside className="flex flex-col gap-2 hyphens-auto break-words rounded-biso-md border border-edge bg-surface-raised p-5 text-ink">
      <span
        className={`type-label inline-flex w-fit rounded-biso-pill border border-current px-3 py-0.5 ${TONE_CLASS[tone]}`}
      >
        {labels[tone]}
      </span>
      <EditableText
        className="type-heading-card text-ink"
        edit={edit}
        onChange={(v) => onPatch("title", v)}
        tag="p"
        value={block.title}
      />
      <EditableText
        className="type-body-sm text-ink"
        edit={edit}
        onChange={(v) => onPatch("body", v)}
        tag="p"
        value={block.body}
      />
    </aside>
  );
}
