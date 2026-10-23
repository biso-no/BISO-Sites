"use client";

import { externalLinkProps, safeHref } from "@/blocks/_v2/links";
import type { PatchFn } from "@/blocks/types";
import { EditableText } from "@/components/editor-shell/canvas/editable-text";
import type { FactItem, FactsBlock } from "@/editor/types";

interface Props {
  block: FactsBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function FactsRender({ block, edit, onPatch }: Props) {
  const update = (i: number, key: "label" | "text", value: string) =>
    onPatch(
      "items",
      block.items.map((x, j) => (j === i ? { ...x, [key]: value } : x))
    );
  const value = (item: FactItem, i: number) => (
    <EditableText
      edit={edit}
      onChange={(v) => update(i, "text", v)}
      tag="span"
      value={item.text}
    />
  );
  return (
    <dl className="m-0 divide-y divide-edge border-edge border-y">
      {block.items.map((item, i) => {
        const href = safeHref(item.href);
        return (
          <div className="py-3" key={i}>
            <dt className="type-label text-ink-muted">
              <EditableText
                edit={edit}
                onChange={(v) => update(i, "label", v)}
                tag="span"
                value={item.label}
              />
            </dt>
            <dd className="type-heading-card m-0 text-ink">
              {href && !edit ? (
                <a
                  className="underline"
                  href={href}
                  {...externalLinkProps(href)}
                >
                  {value(item, i)}
                </a>
              ) : (
                value(item, i)
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
