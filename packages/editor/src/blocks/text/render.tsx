"use client";

import { createElement, type ReactNode, useMemo } from "react";
import { isBlankHtml } from "@/blocks/_v2/blank";
import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { useInEditor } from "@/editor/callbacks";
import type { TextBlock, TextBodyItem } from "@/editor/types";
import { sanitizeRichText } from "@/lib/sanitize";

const HTML_PROP = "dangerouslySetInnerHTML";

// Headings wrap a long word; body copy may break anywhere, since an email
// address or URL has no break opportunity at all.
export const ITEM_CLASS: Record<TextBodyItem["type"], string> = {
  h: "type-display-sm break-words hyphens-auto text-ink [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4",
  h3: "type-heading-card break-words hyphens-auto text-ink [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4",
  li: "type-body text-ink [overflow-wrap:anywhere] [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4",
  p: "type-body text-ink [overflow-wrap:anywhere] [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4",
};

interface Props {
  block: TextBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function TextRender({ block, edit, onPatch }: Props) {
  const items = listOf<TextBodyItem>(block.body);
  if (!edit && items.every((item) => isBlankHtml(item.text))) {
    return null;
  }
  const change = (index: number) => (html: string) => {
    const body = [...items];
    body[index] = { ...body[index], text: html };
    onPatch("body", body);
  };

  // Consecutive list items share one <ul>; every other item stands alone.
  const nodes: ReactNode[] = [];
  let run: ReactNode[] = [];
  const flush = (key: number) => {
    if (run.length === 0) {
      return;
    }
    nodes.push(
      <ul
        className="list-disc space-y-2 pl-5 marker:text-ink-accent"
        key={String(key)}
      >
        {run}
      </ul>
    );
    run = [];
  };

  items.forEach((stored, i) => {
    // An unknown item type (copilot output) is a paragraph.
    const item = { ...stored, type: knownKey(ITEM_CLASS, stored.type, "p") };
    const node = (
      <BodyItem edit={edit} item={item} key={i} onChange={change(i)} />
    );
    if (item.type === "li") {
      run.push(node);
      return;
    }
    flush(i);
    nodes.push(node);
  });
  flush(items.length);

  return (
    <div className="flex max-w-(--measure) flex-col gap-4 text-ink">
      {nodes}
    </div>
  );
}

function BodyItem({
  item,
  edit,
  onChange,
}: {
  item: TextBodyItem;
  edit: boolean;
  onChange: (html: string) => void;
}) {
  const editProps = edit
    ? ({
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-edit": "1",
        onBlur: (e: React.FocusEvent<HTMLElement>) =>
          onChange(sanitizeRichText(e.currentTarget.innerHTML)),
        role: "textbox",
        tabIndex: 0,
      } as Record<string, unknown>)
    : {};

  // The stored value is sanitized HTML. It is rendered as markup in both
  // modes: as a text child it was escaped, and every blur then re-saved the
  // escaped form, so "&" became "&amp;amp;" one blur at a time.
  //
  // The object is memoized on the stored text: React writes innerHTML
  // whenever the prop's identity changes, and a fresh object on every
  // render (hover, selection) would wipe whatever is being typed.
  //
  // Inside the editor, in edit and preview alike, the markup is sanitized
  // again before it runs in the admin session: old rows, direct table writes
  // and copilot or translate output reach the canvas before any save cleans
  // them. The public routes sanitize on the server (`@repo/editor/sanitize`)
  // before the document reaches this renderer.
  const inEditor = useInEditor();
  const html = useMemo(
    () => ({
      __html:
        inEditor && typeof document !== "undefined"
          ? sanitizeRichText(item.text)
          : item.text,
    }),
    [inEditor, item.text]
  );
  const props = {
    ...editProps,
    className: ITEM_CLASS[item.type],
    [HTML_PROP]: html,
  };

  if (item.type === "h") {
    return createElement("h2", props);
  }
  if (item.type === "h3") {
    return createElement("h3", props);
  }
  if (item.type === "li") {
    return createElement("li", props);
  }
  return createElement("p", props);
}
