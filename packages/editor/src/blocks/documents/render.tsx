"use client";

import { externalLinkProps } from "@/blocks/_v2";
import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { DocumentItem, DocumentsBlock } from "@/editor/types";
import {
  accessibleName,
  downloadHref,
  downloadLabel,
  metaLine,
} from "./format";

interface Props {
  block: DocumentsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

const LINK_CLASS =
  "type-label shrink-0 text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

const FALLBACK_TITLE = { en: "Document", no: "Dokument" } as const;
/** Editor-only: the editor's own chrome is English. */
const EMPTY_NOTE = "Add documents in the inspector.";

const text = (v: unknown): string => (typeof v === "string" ? v : "");

export function DocumentsRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const items = listOf<DocumentItem>(block.items);
  const heading = text(block.heading);
  // The site drops a row it cannot link; the editor keeps it so it can be fixed.
  const rows = items
    .map((item, index) => ({ href: downloadHref(item), index, item }))
    .filter(({ href }) => edit || href !== null);

  if (!edit && rows.length === 0) {
    return null;
  }

  const update = (index: number, title: string) =>
    onPatch(
      "items",
      items.map((x, j) => (j === index ? { ...x, title } : x))
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
      {rows.length === 0 ? (
        <p className="type-body-sm m-0 rounded-biso-md border border-edge border-dashed p-6 text-ink-muted">
          {EMPTY_NOTE}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-edge border-edge border-y p-0">
          {rows.map(({ href, index, item }) => {
            const lang = locale === "en" ? "en" : "no";
            const title = text(item.title).trim() || FALLBACK_TITLE[lang];
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
                key={index}
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <EditableText
                    className="type-heading-card min-w-0 break-words text-ink"
                    edit={edit}
                    onChange={(v) => update(index, v)}
                    tag="span"
                    value={edit ? text(item.title) : title}
                  />
                  <span className="type-body-sm text-ink-muted">
                    {metaLine(item, lang)}
                  </span>
                </div>
                {edit || href === null ? (
                  <span className={LINK_CLASS}>{downloadLabel(lang)}</span>
                ) : (
                  <a
                    aria-label={accessibleName({ ...item, title }, lang)}
                    className={LINK_CLASS}
                    download
                    href={href}
                    {...externalLinkProps(href)}
                  >
                    {downloadLabel(lang)}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
