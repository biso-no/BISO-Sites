"use client";

import type { HTMLAttributes } from "react";

type Tag = "p" | "h1" | "h2" | "h3" | "span" | "div";

interface Props extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  edit: boolean;
  onChange?: (value: string) => void;
  tag?: Tag;
  value: string;
}

export function EditableText({
  tag: Tag = "p",
  value,
  edit,
  onChange,
  ...rest
}: Props) {
  if (!edit) {
    return <Tag {...(rest as HTMLAttributes<HTMLElement>)}>{value}</Tag>;
  }

  return (
    <Tag
      {...(rest as HTMLAttributes<HTMLElement>)}
      contentEditable
      data-edit="1"
      onBlur={(e) =>
        onChange?.((e.currentTarget as HTMLElement).textContent ?? "")
      }
      suppressContentEditableWarning
    >
      {value}
    </Tag>
  );
}
