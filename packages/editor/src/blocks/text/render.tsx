"use client";

import { createElement, type ReactNode, Suspense, useMemo } from "react";
import { isBlankHtml } from "@/blocks/_v2/blank";
import { knownKey } from "@/blocks/_v2/known-key";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { useInEditor } from "@/editor/callbacks";
import type { TextBlock, TextBodyItem } from "@/editor/types";
import { sanitizeRichBody, sanitizeRichText } from "@/lib/sanitize";
import { bodyToHtml, isLegacyBody } from "./body";
import { RichTextField, useMounted } from "./lazy-field";
import { RICH_CLASS } from "./render-classes";

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

/**
 * A text block. In edit mode, any body is one Plate field on the canvas. On
 * the site, an HTML body renders in the rich wrapper and a legacy array
 * renders exactly as it always has.
 */
export function TextRender({ block, edit, onPatch }: Props) {
  if (edit) {
    return <EditBody block={block} onPatch={onPatch} />;
  }
  if (isLegacyBody(block.body)) {
    return <LegacyBody body={block.body} />;
  }
  if (isBlankHtml(block.body)) {
    return null;
  }
  return <RichBody html={block.body} />;
}

/**
 * The canvas field, drawn once the client has mounted and its chunk has
 * loaded. Until then, and on the server, the body shows as on the site.
 */
function EditBody({ block, onPatch }: { block: TextBlock; onPatch: PatchFn }) {
  const mounted = useMounted();
  const html = bodyToHtml(block.body);
  const fallback = <RichBody html={html} />;
  if (!mounted) {
    return fallback;
  }
  return (
    <Suspense fallback={fallback}>
      <RichTextField
        html={html}
        label="Rich text"
        onChange={(next) =>
          onPatch("body", next, { coalesce: `${block.id}:body` })
        }
        variant="canvas"
      />
    </Suspense>
  );
}

/**
 * Body HTML in the public wrapper. The public routes sanitize on the server
 * (`@repo/editor/sanitize`) before the document reaches this renderer.
 * Inside the editor the markup is sanitized again before it runs in the
 * admin session: old rows, direct table writes, copilot or translate output
 * and legacy bodies turned into HTML reach the canvas before any save cleans
 * them. Memoized on the string, so it is cleaned once per change.
 */
function RichBody({ html }: { html: string }) {
  const inEditor = useInEditor();
  const markup = useMemo(
    () => ({
      __html:
        inEditor && typeof document !== "undefined"
          ? sanitizeRichBody(html)
          : html,
    }),
    [inEditor, html]
  );
  return createElement("div", { className: RICH_CLASS, [HTML_PROP]: markup });
}

/** A legacy array body on the site: one element per item, as always. */
function LegacyBody({ body }: { body: TextBodyItem[] }) {
  const items = listOf<TextBodyItem>(body);
  if (items.every((item) => isBlankHtml(item.text))) {
    return null;
  }

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
    const node = <BodyItem item={item} key={i} />;
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

function BodyItem({ item }: { item: TextBodyItem }) {
  // The stored value is sanitized HTML, rendered as markup.
  //
  // The object is memoized on the stored text: React writes innerHTML
  // whenever the prop's identity changes.
  //
  // Inside the editor (preview) the markup is sanitized again before it runs
  // in the admin session: old rows, direct table writes and copilot or
  // translate output reach the canvas before any save cleans them. The
  // public routes sanitize on the server (`@repo/editor/sanitize`) before
  // the document reaches this renderer.
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
