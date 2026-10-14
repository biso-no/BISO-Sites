"use client";

import { createElement } from "react";
import type { PatchFn } from "@/blocks/types";
import type { TextBlock, TextBodyItem } from "@/editor/types";
import { sanitizeRichText } from "@/lib/sanitize";

const HTML_PROP = "dangerouslySetInnerHTML";

interface Props {
  block: TextBlock;
  edit: boolean;
  onPatch: PatchFn;
}

export function TextRender({ block, edit, onPatch }: Props) {
  return (
    <div className="pg-text pg-block">
      {block.body.map((item, i) => (
        <BodyItem
          edit={edit}
          item={item}
          key={i}
          onChange={(html) => {
            const body = [...block.body];
            body[i] = { ...body[i], text: html };
            onPatch("body", body);
          }}
        />
      ))}
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
  const props = { ...editProps, [HTML_PROP]: { __html: item.text } };

  if (item.type === "h") {
    return createElement("h2", props);
  }
  if (item.type === "h3") {
    return createElement("h3", props);
  }
  if (item.type === "li") {
    return <ul>{createElement("li", props)}</ul>;
  }
  return createElement("p", props);
}
