"use client";

import type { Value } from "platejs";
import {
  Plate,
  PlateContent,
  type PlateEditor,
  usePlateEditor,
} from "platejs/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { RICH_CLASS } from "../render-classes";
import { RichBubble } from "./bubble";
import { htmlToValue, valueToHtml } from "./html";
import { richReactPlugins } from "./react-plugins";
import { htmlToEmit, shouldTakeProp } from "./sync";
import { RichToolbar } from "./toolbar";

export interface RichTextFieldProps {
  /** Receives the Plate editor; tests only. */
  editorRef?: { current: unknown };
  html: string;
  label: string;
  onChange: (html: string) => void;
  variant: "panel" | "canvas";
}

/**
 * How long an unfocused field waits after the last change of its `html`
 * prop before it takes it. A long body is slow to parse, and the other
 * surface changes the prop on every keystroke.
 */
const TAKE_DELAY_MS = 300;

/**
 * Takes the pending prop, if any: replaces the value unless the prop is, in
 * canonical form, what the field already holds. The field's undo history
 * starts again, so mod+z never replays the other surface's edit.
 */
function takePending(
  editor: PlateEditor,
  lastHtml: RefObject<string>,
  pending: RefObject<string | null>
): void {
  const html = pending.current;
  pending.current = null;
  if (html === null) {
    return;
  }
  const value = htmlToValue(html);
  const propHtml = valueToHtml(value);
  if (propHtml === lastHtml.current) {
    return;
  }
  // First, so the change `setValue` causes reports nothing.
  lastHtml.current = propHtml;
  editor.tf.setValue(value);
  editor.history.redos = [];
  editor.history.undos = [];
}

/**
 * A rich text body as one Plate editing surface. It reports canonical HTML
 * (`valueToHtml`) and takes a new `html` prop only when that differs from
 * what it last reported and it is not focused, so the panel and the canvas
 * can edit one value without moving each other's caret. The panel shows the
 * toolbar above the text; the canvas shows it in a bubble over a selection.
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
  // A changed prop the field has not taken yet.
  const pending = useRef<string | null>(null);
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
    // Its own echo, or a focused field keeping its text: nothing to parse.
    // An echo is the exact string the field reported.
    if (!shouldTakeProp(html, lastHtml.current, editor.api.isFocused())) {
      pending.current = null;
      return;
    }
    pending.current = html;
    const timer = setTimeout(
      () => takePending(editor, lastHtml, pending),
      TAKE_DELAY_MS
    );
    return () => clearTimeout(timer);
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

  // `onValueChange`, not `onChange`: a caret move changes no HTML. Focus
  // takes a pending prop before the first keystroke can build on old text.
  return (
    <Plate editor={editor} onValueChange={handleValueChange}>
      {variant === "panel" ? (
        <RichToolbar editor={editor} tone="paper" />
      ) : null}
      <PlateContent
        aria-label={label}
        onFocus={() => takePending(editor, lastHtml, pending)}
        {...surface}
      />
      {variant === "canvas" ? <RichBubble editor={editor} /> : null}
    </Plate>
  );
}
