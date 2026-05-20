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

  const html = { __html: item.text };

  if (item.type === "h") {
    return edit ? (
      <h2 {...editProps}>{item.text}</h2>
    ) : (
      createElement("h2", { [HTML_PROP]: html })
    );
  }
  if (item.type === "h3") {
    return edit ? (
      <h3 {...editProps}>{item.text}</h3>
    ) : (
      createElement("h3", { [HTML_PROP]: html })
    );
  }
  if (item.type === "li") {
    return (
      <ul>
        {edit ? (
          <li {...editProps}>{item.text}</li>
        ) : (
          createElement("li", { [HTML_PROP]: html })
        )}
      </ul>
    );
  }
  return edit ? (
    <p {...editProps}>{item.text}</p>
  ) : (
    createElement("p", { [HTML_PROP]: html })
  );
}
