"use client";

import { createElement, useMemo } from "react";
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
  //
  // The object is memoized on the stored text: React writes innerHTML
  // whenever the prop's identity changes, and a fresh object on every
  // render (hover, selection) would wipe whatever is being typed. In edit
  // mode the markup is sanitized again before it is run inside the admin,
  // since rows saved before the sanitizer existed were never cleaned.
  const html = useMemo(
    () => ({
      __html:
        edit && typeof document !== "undefined"
          ? sanitizeRichText(item.text)
          : item.text,
    }),
    [edit, item.text]
  );
  const props = { ...editProps, [HTML_PROP]: html };

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
