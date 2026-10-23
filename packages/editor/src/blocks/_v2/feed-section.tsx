"use client";

import type { ReactNode } from "react";
import { LINK_CLASS, MARKER_CLASS } from "@/blocks/heading/render";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { EditorLocale } from "@/editor/types";
import { cardGridClass } from "./card-grid";
import { externalLinkProps, safeHref } from "./links";

const SEE_ALL: Record<EditorLocale, string> = {
  en: "See all →",
  no: "Se alle →",
};

const CARD_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface";

interface SectionProps {
  children: ReactNode;
  /** Department id the feed reads from; empty when none is chosen. */
  dept: string;
  edit: boolean;
  heading: string;
  /** Rows to show, or null while the feed is unresolved. */
  items: unknown[] | null;
  locale: EditorLocale;
  /** "No <noun> for <dept>" in the editor when the feed is empty. */
  noun: string;
  onPatch: PatchFn;
  seeAll: boolean;
  seeAllHref: string;
}

/** Why the editor shows no cards. Chrome copy, so always English. */
function placeholderText(
  dept: string,
  items: unknown[] | null,
  noun: string,
  deptName: string
): string {
  if (!dept) {
    return "Choose a department";
  }
  if (items === null) {
    return "Loading…";
  }
  return `No ${noun} for ${deptName}`;
}

/**
 * Heading plus card grid shared by the live events, news and jobs blocks.
 * Nothing is rendered on the site without cards: a live block never shows
 * invented content. The editor shows a placeholder that says why instead.
 */
export function FeedSection({
  children,
  dept,
  edit,
  heading,
  items,
  locale,
  noun,
  onPatch,
  seeAll,
  seeAllHref,
}: SectionProps) {
  const { departments } = useEditorCallbacks();
  const hasCards = (items?.length ?? 0) > 0 && !!dept;
  if (!(hasCards || edit)) {
    return null;
  }
  const deptName = departments.find((d) => d.id === dept)?.name ?? dept;
  const href = safeHref(seeAllHref);
  const showLink = seeAll && !!href;

  return (
    <div className="flex flex-col gap-6 break-words">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="type-heading-section isolate min-w-0 hyphens-auto break-words text-ink">
          <span className={showLink ? MARKER_CLASS : undefined}>
            {edit ? (
              <EditableText
                edit
                onChange={(v) => onPatch("heading", v)}
                tag="span"
                value={heading}
              />
            ) : (
              heading
            )}
          </span>
        </h2>
        {showLink && !edit ? (
          <a className={LINK_CLASS} href={href} {...externalLinkProps(href)}>
            {SEE_ALL[locale] ?? SEE_ALL.no}
          </a>
        ) : null}
        {/* On the canvas a click must select the block, not navigate. */}
        {showLink && edit ? (
          <span className="type-body-sm text-ink-accent">
            {SEE_ALL[locale] ?? SEE_ALL.no}
          </span>
        ) : null}
      </div>
      {hasCards ? (
        <ul className={`${cardGridClass(3)} m-0 list-none p-0`}>{children}</ul>
      ) : (
        <p className="type-body-sm rounded-biso-md border border-edge border-dashed p-4 text-center text-ink-muted">
          {placeholderText(dept, items, noun, deptName)}
        </p>
      )}
    </div>
  );
}

/**
 * One card's outer element. A link on the site; a plain box in the editor, or
 * when the row has no usable route, so it never links to a 404.
 */
export function FeedCardShell({
  className,
  edit,
  href,
  children,
}: {
  children: ReactNode;
  className: string;
  edit: boolean;
  href: string | undefined;
}) {
  const safe = safeHref(href);
  return (
    <li>
      {safe && !edit ? (
        <a
          className={`${className} ${CARD_FOCUS}`}
          href={safe}
          {...externalLinkProps(safe)}
        >
          {children}
        </a>
      ) : (
        <div className={className}>{children}</div>
      )}
    </li>
  );
}
