"use client";

import type { ReactNode } from "react";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { useEditorCallbacks } from "@/editor/callbacks";
import type { EditorLocale } from "@/editor/types";
import { cardGridClass, type GridColumns } from "./card-grid";
import { externalLinkProps, safeHref } from "./links";
import { LINK_CLASS, MARKER_CLASS } from "./section-title";

const SEE_ALL: Record<EditorLocale, string> = {
  en: "See all →",
  no: "Se alle →",
};

const CARD_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface";

interface SectionProps {
  children: ReactNode;
  /** Card columns at the widest container; defaults to 3. */
  columns?: GridColumns;
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
  /** False for feeds that are not read from a department (partners, units). */
  requireDept?: boolean;
  seeAll: boolean;
  seeAllHref: string;
}

/** Why the editor shows no cards. Chrome copy, so always English. */
function placeholderText(
  dept: string,
  items: unknown[] | null,
  noun: string,
  deptName: string,
  requireDept: boolean
): string {
  if (requireDept && !dept) {
    return "Choose a department";
  }
  if (items === null) {
    return "Loading…";
  }
  return requireDept ? `No ${noun} for ${deptName}` : `No ${noun}`;
}

/**
 * Heading plus card grid shared by the live events, news and jobs blocks.
 * Nothing is rendered on the site without cards: a live block never shows
 * invented content. The editor shows a placeholder that says why instead.
 */
export function FeedSection({
  children,
  columns = 3,
  dept,
  edit,
  heading,
  items,
  locale,
  noun,
  onPatch,
  requireDept = true,
  seeAll,
  seeAllHref,
}: SectionProps) {
  const { departments } = useEditorCallbacks();
  const hasCards = (items?.length ?? 0) > 0 && (!requireDept || !!dept);
  if (!(hasCards || edit)) {
    return null;
  }
  const deptName = departments.find((d) => d.id === dept)?.name ?? dept;
  const href = safeHref(seeAllHref);
  const showLink = seeAll && !!href;
  // A blank heading is not an empty <h2> on the site; the editor keeps it so
  // there is something to click into.
  const showTitle = edit || heading.trim() !== "";

  return (
    <div className="flex flex-col gap-6 break-words">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {showTitle ? (
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
        ) : null}
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
        <ul className={`${cardGridClass(columns)} m-0 list-none p-0`}>
          {children}
        </ul>
      ) : (
        <p className="type-body-sm rounded-biso-md border border-edge border-dashed p-4 text-center text-ink-muted">
          {placeholderText(dept, items, noun, deptName, requireDept)}
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
