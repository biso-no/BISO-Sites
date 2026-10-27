"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { withoutBlankItems } from "@/blocks/_v2/blank";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { FaqBlock, FaqItem } from "@/editor/types";

interface Props {
  block: FaqBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

const SUMMARY_CLASS =
  "type-heading-card flex min-w-0 cursor-pointer list-none items-start justify-between gap-4 break-words py-4 text-ink marker:content-none focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden after:shrink-0 after:text-ink-accent after:content-['+'] group-open:after:content-['–']";

/**
 * The question row. In the editor the item stays open so its answer can be
 * edited, so a click must not toggle it. The listener is native (not React's)
 * because it has to run before the details element handles the click.
 */
function Summary({ children, edit }: { children: ReactNode; edit: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!(edit && el)) {
      return;
    }
    const keepOpen = (e: Event) => e.preventDefault();
    el.addEventListener("click", keepOpen);
    return () => el.removeEventListener("click", keepOpen);
  }, [edit]);
  return (
    <summary className={SUMMARY_CLASS} ref={ref}>
      {children}
    </summary>
  );
}

export function FaqRender({ block, edit, onPatch }: Props) {
  const items = withoutBlankItems(
    listOf<FaqItem>(block.items),
    (x) => [x.q, x.a],
    edit
  );
  const heading = text(block.heading);
  if (!edit && items.length === 0) {
    return null;
  }
  const update = (i: number, key: "a" | "q", value: string) =>
    onPatch(
      "items",
      items.map((x, j) => (j === i ? { ...x, [key]: value } : x))
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
      <div className="divide-y divide-edge border-edge border-y">
        {items.map((item, i) => (
          <details className="group" key={i} open={edit || undefined}>
            <Summary edit={edit}>
              <EditableText
                className="min-w-0"
                edit={edit}
                onChange={(v) => update(i, "q", v)}
                tag="span"
                value={text(item.q)}
              />
            </Summary>
            <EditableText
              className="type-body m-0 min-w-0 whitespace-pre-line break-words pb-4 text-ink-muted"
              edit={edit}
              onChange={(v) => update(i, "a", v)}
              tag="p"
              value={text(item.a)}
            />
          </details>
        ))}
      </div>
    </div>
  );
}
