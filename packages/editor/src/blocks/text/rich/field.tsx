"use client";

import type { Value } from "platejs";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { useEffect, useRef, useState } from "react";
import { RICH_CLASS } from "../render-classes";
import { htmlToValue, valueToHtml } from "./html";
import { richReactPlugins } from "./react-plugins";
import { htmlToEmit, shouldTakeProp } from "./sync";

export interface RichTextFieldProps {
  /** Receives the Plate editor; tests only. */
  editorRef?: { current: unknown };
  html: string;
  label: string;
  onChange: (html: string) => void;
  variant: "panel" | "canvas";
}

/**
 * A rich text body as one Plate editing surface. It reports canonical HTML
 * (`valueToHtml`) and takes a new `html` prop only when that differs from
 * what it last reported and it is not focused, so the panel and the canvas
 * can edit one value without moving each other's caret.
 *
 * Needs a DOM (`htmlToValue`): render it only after the client has mounted.
 */
export default function RichTextField({
  editorRef,
  html,
  label,
  onChange,
  variant,
}: RichTextFieldProps) {
  const [initial] = useState(() => {
    const value = htmlToValue(html);
    return { html: valueToHtml(value), value };
  });
  // Canonical, so mounting a legacy body reports nothing.
  const lastHtml = useRef(initial.html);
  const editor = usePlateEditor({
    plugins: richReactPlugins,
    value: initial.value,
  });

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  useEffect(() => {
    const value = htmlToValue(html);
    const propHtml = valueToHtml(value);
    if (!shouldTakeProp(propHtml, lastHtml.current, editor.api.isFocused())) {
      return;
    }
    // First, so the change `setValue` causes reports nothing.
    lastHtml.current = propHtml;
    editor.tf.setValue(value);
  }, [editor, html]);

  const handleValueChange = ({ value }: { value: Value }) => {
    const next = htmlToEmit(value, lastHtml.current);
    if (next !== null) {
      lastHtml.current = next;
      onChange(next);
    }
  };

  const surface =
    variant === "canvas"
      ? { className: RICH_CLASS, "data-rich-edit": "1" }
      : { className: "pe-rt-field" };

  // `onValueChange`, not `onChange`: a caret move changes no HTML.
  return (
    <Plate editor={editor} onValueChange={handleValueChange}>
      <PlateContent aria-label={label} {...surface} />
    </Plate>
  );
}
