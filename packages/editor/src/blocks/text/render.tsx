"use client";

import type { PatchFn } from "@/blocks/types";
import type { TextBlock, TextBodyItem } from "@/editor/types";
import { sanitizeRichText } from "@/lib/sanitize";

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
      } as Record<string, unknown>)
    : {};

  const html = { __html: item.text };

  if (item.type === "h") {
    return (
      <h2 {...editProps} dangerouslySetInnerHTML={edit ? undefined : html}>
        {edit ? item.text : undefined}
      </h2>
    );
  }
  if (item.type === "h3") {
    return (
      <h3 {...editProps} dangerouslySetInnerHTML={edit ? undefined : html}>
        {edit ? item.text : undefined}
      </h3>
    );
  }
  if (item.type === "li") {
    return (
      <ul>
        <li {...editProps} dangerouslySetInnerHTML={edit ? undefined : html}>
          {edit ? item.text : undefined}
        </li>
      </ul>
    );
  }
  return (
    <p {...editProps} dangerouslySetInnerHTML={edit ? undefined : html}>
      {edit ? item.text : undefined}
    </p>
  );
}
