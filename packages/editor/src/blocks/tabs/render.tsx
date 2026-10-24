"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { withoutBlankItems } from "@/blocks/_v2/blank";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { TabItem, TabsBlock } from "@/editor/types";

interface Props {
  block: TabsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

const TABS_LABEL = { en: "Tabs", no: "Faner" } as const;

const TAB_CLASS =
  "type-label -mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-4 py-3 focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

export function TabsRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const tabs = withoutBlankItems(
    listOf<TabItem>(block.tabs),
    (x) => [x.label, x.body],
    edit
  );
  const [chosen, setChosen] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  // Ids come from the block id, so server and client markup match.
  const baseId = text(block.id) || "tabs";
  const active = Math.min(chosen, Math.max(tabs.length - 1, 0));

  const select = (index: number, focus: boolean) => {
    setChosen(index);
    if (focus) {
      list.current
        ?.querySelector<HTMLElement>(`[id="${baseId}-tab-${index}"]`)
        ?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (e.key === "ArrowRight") {
      next = active === last ? 0 : active + 1;
    } else if (e.key === "ArrowLeft") {
      next = active === 0 ? last : active - 1;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = last;
    }
    if (next === null) {
      return;
    }
    e.preventDefault();
    select(next, true);
  };

  const updateBody = (i: number, body: string) =>
    onPatch(
      "tabs",
      tabs.map((x, j) => (j === i ? { ...x, body } : x))
    );

  if (!edit && tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 break-words">
      <div
        aria-label={TABS_LABEL[locale] ?? TABS_LABEL.no}
        className="flex overflow-x-auto border-edge border-b"
        onKeyDown={onKeyDown}
        ref={list}
        role="tablist"
      >
        {tabs.map((tab, i) => (
          <button
            aria-controls={`${baseId}-panel-${i}`}
            aria-selected={active === i}
            className={`${TAB_CLASS} ${
              active === i
                ? "border-action text-ink"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
            id={`${baseId}-tab-${i}`}
            key={i}
            onClick={() => select(i, false)}
            role="tab"
            tabIndex={active === i ? 0 : -1}
            type="button"
          >
            {text(tab.label)}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          aria-labelledby={`${baseId}-tab-${i}`}
          hidden={active !== i}
          id={`${baseId}-panel-${i}`}
          key={i}
          role="tabpanel"
          // WAI-ARIA: a panel without a focusable first child takes focus itself.
          // biome-ignore lint/a11y/noNoninteractiveTabindex: required by the tabs pattern.
          tabIndex={0}
        >
          <EditableText
            className="type-body m-0 min-w-0 whitespace-pre-line break-words text-ink-muted"
            edit={edit && active === i}
            onChange={(v) => updateBody(i, v)}
            tag="p"
            value={text(tab.body)}
          />
        </div>
      ))}
    </div>
  );
}
