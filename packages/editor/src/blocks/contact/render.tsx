"use client";

import { externalLinkProps, safeHref } from "@/blocks/_v2/links";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import { usePageFeedSource } from "@/editor/page-feed-context";
import type { ContactBlock, EditorLocale } from "@/editor/types";

interface Props {
  block: ContactBlock;
  edit: boolean;
  onPatch: PatchFn;
}

type Field = "address" | "email" | "hours" | "instagram" | "phone";

const FIELDS: Field[] = ["email", "phone", "instagram", "address", "hours"];

const LABELS: Record<EditorLocale, Record<Field, string>> = {
  en: {
    address: "Address",
    email: "Email",
    hours: "Hours",
    instagram: "Instagram",
    phone: "Phone",
  },
  no: {
    address: "Adresse",
    email: "E-post",
    hours: "Åpningstider",
    instagram: "Instagram",
    phone: "Telefon",
  },
};

const LEADING_AT = /^@+/;
const WHITESPACE = /\s+/g;
const HANDLE = /^[\w.]+$/;

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Where a field's value links to, or null when it is plain text. */
function hrefFor(field: Field, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (field === "email") {
    return safeHref(`mailto:${trimmed}`);
  }
  if (field === "phone") {
    return safeHref(`tel:${trimmed.replace(WHITESPACE, "")}`);
  }
  if (field === "instagram") {
    const handle = trimmed.replace(LEADING_AT, "");
    return HANDLE.test(handle)
      ? `https://www.instagram.com/${handle}/`
      : safeHref(trimmed);
  }
  return null;
}

export function ContactRender({ block, edit, onPatch }: Props) {
  const { locale } = usePageFeedSource();
  const labels = LABELS[locale] ?? LABELS.no;
  const values = FIELDS.map((field) => [field, text(block[field])] as const);
  const shown = edit
    ? values
    : values.filter(([, value]) => value.trim() !== "");

  // Nothing to say on the site is nothing on the page, heading included.
  if (shown.length === 0) {
    return null;
  }
  const heading = text(block.heading);

  return (
    <div className="flex flex-col gap-6 break-words">
      {edit || heading.trim() !== "" ? (
        <h2 className="type-heading-section min-w-0 hyphens-auto break-words text-ink">
          <EditableText
            edit={edit}
            onChange={(v) => onPatch("heading", v)}
            tag="span"
            value={heading}
          />
        </h2>
      ) : null}
      <dl className="m-0 divide-y divide-edge border-edge border-y">
        {shown.map(([field, value]) => {
          const href = hrefFor(field, value);
          const content = (
            <EditableText
              edit={edit}
              onChange={(v) => onPatch(field, v)}
              tag="span"
              value={value}
            />
          );
          return (
            <div className="py-3" key={field}>
              <dt className="type-label text-ink-muted">{labels[field]}</dt>
              {/* Emails and handles have no break opportunity. */}
              <dd className="type-heading-card m-0 text-ink [overflow-wrap:anywhere]">
                {href && !edit ? (
                  <a
                    className="underline"
                    href={href}
                    {...externalLinkProps(href)}
                  >
                    {content}
                  </a>
                ) : (
                  content
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
