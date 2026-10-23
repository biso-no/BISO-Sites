"use client";

import { knownKey } from "@/blocks/_v2/known-key";
import { externalLinkProps, safeHref } from "@/blocks/_v2/links";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { HeadingBlock } from "@/editor/types";

export const TITLE_CLASS: Record<HeadingBlock["size"], string> = {
  large: "type-display-lg",
  medium: "type-display-sm",
  small: "type-heading-section",
};

// A 3px stroke behind the title's text, drawn on a pseudo-element so the text
// keeps the section's own surface as its background (same as the site's
// SectionHeading).
const MARKER_CLASS =
  "relative pb-1 after:absolute after:inset-x-0 after:bottom-0 after:-z-10 after:h-[3px] after:bg-marker after:content-['']";

const LINK_CLASS =
  "type-body-sm text-ink-accent underline-offset-4 hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

interface Props {
  block: HeadingBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function HeadingRender({ block, edit, onPatch }: Props) {
  const linkHref = safeHref(block.link?.href);
  const link =
    linkHref && block.link?.label
      ? { href: linkHref, label: block.link.label }
      : undefined;
  const size = knownKey(TITLE_CLASS, block.size, "medium");
  return (
    <div className="flex flex-col gap-3 break-words">
      {(block.eyebrow || edit) && (
        <EditableText
          className="type-label text-ink-accent"
          edit={edit}
          onChange={(v) => onPatch("eyebrow", v)}
          tag="p"
          value={block.eyebrow}
        />
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        {/* `isolate`: the marker's -z-10 stroke stays inside the title
            instead of dropping behind the section's background. */}
        <h2
          className={`${TITLE_CLASS[size]} isolate min-w-0 hyphens-auto break-words text-ink`}
        >
          <span className={link ? MARKER_CLASS : undefined}>
            {edit ? (
              <EditableText
                edit
                onChange={(v) => onPatch("title", v)}
                tag="span"
                value={block.title}
              />
            ) : (
              block.title
            )}
          </span>
        </h2>
        {link && !edit ? (
          <a
            className={LINK_CLASS}
            href={link.href}
            {...externalLinkProps(link.href)}
          >
            {link.label} →
          </a>
        ) : null}
        {/* On the canvas a click must not navigate away from unsaved edits. */}
        {link && edit ? (
          <span className="type-body-sm text-ink-accent">{link.label} →</span>
        ) : null}
      </div>
      {(block.intro || edit) && (
        <EditableText
          className="type-body max-w-(--measure) text-ink-muted"
          edit={edit}
          onChange={(v) => onPatch("intro", v)}
          tag="p"
          value={block.intro}
        />
      )}
    </div>
  );
}
