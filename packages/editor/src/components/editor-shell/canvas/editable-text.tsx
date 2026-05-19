"use client";

import type { HTMLAttributes } from "react";

type Tag = "p" | "h1" | "h2" | "h3" | "span" | "div";

interface Props extends Omit<HTMLAttributes<HTMLElement>, "onChange"> {
  tag?: Tag;
  value: string;
  edit: boolean;
  onChange?: (value: string) => void;
}

export function EditableText({ tag: Tag = "p", value, edit, onChange, ...rest }: Props) {
  if (!edit) {
    return <Tag {...(rest as HTMLAttributes<HTMLElement>)}>{value}</Tag>;
  }

  return (
    <Tag
      {...(rest as HTMLAttributes<HTMLElement>)}
      contentEditable
      suppressContentEditableWarning
      data-edit="1"
      onBlur={(e) => onChange?.((e.currentTarget as HTMLElement).textContent ?? "")}
    >
      {value}
    </Tag>
  );
}
