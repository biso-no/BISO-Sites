"use client";

import { normalizeNodeId, type Point, TextApi, type Value } from "platejs";
import {
  Plate,
  PlateContent,
  type PlateEditor,
  useEditorPluginOption,
  usePlateEditor,
} from "platejs/react";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PatchOptions } from "@/blocks/types";
import { RICH_CLASS } from "../render-classes";
import { RichBubble } from "./bubble";
import { htmlToValue, valueToHtml } from "./html";
import { usePageSwatches } from "./page-swatches";
import { RichPastePlugin } from "./paste-plugin";
import { RichKeysPlugin, richReactPlugins } from "./react-plugins";
import { htmlToEmit, shouldTakeProp } from "./sync";
import { RichToolbar } from "./toolbar";

export interface RichTextFieldProps {
  /** Focuses the text once it mounts, as the wide writing view opens. */
  autoFocus?: boolean;
  /** Receives the Plate editor; tests only. */
  editorRef?: { current: unknown };
  html: string;
  label: string;
  /**
   * Gets each change's HTML; the field's own undo or redo comes with
   * `historyNeutral`, since the page's history holds that step already.
   */
  onChange: (
    html: string,
    options?: Pick<PatchOptions, "historyNeutral">
  ) => void;
  /**
   * Steps the page's history, for mod+z or mod+shift+z with nothing left in
   * the field's own; the field then shows the page's body for it at once.
   */
  onPageHistory?: (step: "undo" | "redo") => void;
  variant: "panel" | "canvas";
}

/**
 * How long an unfocused field waits after the last change of its `html`
 * prop before it takes it. A long body is slow to parse, and the other
 * surface changes the prop on every keystroke.
 */
const TAKE_DELAY_MS = 300;

/** How long the dropped-image notice stays. */
const NOTICE_MS = 6000;
const IMAGE_NOTICE = "Images aren't pasted into text — use an Image block.";

/** Whether `point` still lies in a text of the editor's value. */
const fits = (editor: PlateEditor, point: Point): boolean => {
  const node = editor.api.node(point.path)?.[0];
  return TextApi.isText(node) && point.offset <= node.text.length;
};

/**
 * Takes `html`, the latest prop: replaces the value unless the prop is, in
 * canonical form, what the field already holds. The selection stays where
 * it was when it still fits the new text, so a toolbar command that took the
 * prop acts on it. The field's undo history starts again, so mod+z never
 * replays the other surface's edit.
 */
function takeProp(
  editor: PlateEditor,
  lastHtml: RefObject<string>,
  html: string
): void {
  const value = htmlToValue(html);
  const propHtml = valueToHtml(value);
  if (propHtml === lastHtml.current) {
    return;
  }
  const { selection } = editor;
  // First, so the change `setValue` causes reports nothing.
  lastHtml.current = propHtml;
  editor.tf.setValue(value);
  if (
    selection &&
    fits(editor, selection.anchor) &&
    fits(editor, selection.focus)
  ) {
    editor.tf.select(selection);
  }
  editor.history.redos = [];
  editor.history.undos = [];
}

/**
 * A rich text body as one Plate editing surface. It reports canonical HTML
 * (`valueToHtml`) and takes a new `html` prop only when that differs from
 * what it last reported and it is not focused, so the panel and the canvas
 * can edit one value without moving each other's caret. A prop that changes
 * while the field is focused is taken on focus out, after the same delay.
 * While the link input is open the prop waits too, since the input acts on
 * a selection in the text it opened on; it is taken when the input closes.
 * After mod+z or mod+shift+z stepped the page (`onPageHistory`), the next
 * changed prop is taken at once, focused or not, and the field's own
 * history starts again. mod+z and mod+shift+z take a pending prop before
 * they act, so the page's undo reverts that outside change. The field's own
 * undo and redo report their change as `historyNeutral`, so it adds no page
 * step.
 * The panel shows the toolbar above the text; the canvas shows it in a
 * bubble over a selection.
 *
 * Needs a DOM (`htmlToValue`): render it only after the client has mounted.
 */
export default function RichTextField({
  autoFocus,
  editorRef,
  html,
  label,
  onChange,
  onPageHistory,
  variant,
}: RichTextFieldProps) {
  const [initial] = useState(() => {
    const value = htmlToValue(html);
    return { html: valueToHtml(value), value: normalizeNodeId(value) };
  });
  // Canonical, so mounting a legacy body reports nothing.
  const lastHtml = useRef(initial.html);
  // The latest prop, and whether it changed since the field last took one.
  const latestHtml = useRef(html);
  const pending = useRef(false);
  // A page step this field asked for: its body shows at once, even focused.
  const forceTake = useRef(false);
  const takeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editor = usePlateEditor({
    // Plate's default, except under NODE_ENV "test": set, so tests run the
    // editor the page runs. The merge-aware table transforms find each
    // cell's place in the grid by its id. The first value comes with its ids
    // (`normalizeNodeId`), so Plate need not add them by operations, whose
    // change would be reported after the field mounted.
    nodeId: true,
    plugins: richReactPlugins,
    value: initial.value,
  });
  const linkOpen = useEditorPluginOption(editor, RichKeysPlugin, "linkOpen");
  const linkWasOpen = useRef(false);
  const swatches = usePageSwatches();
  const imageNotices = useEditorPluginOption(
    editor,
    RichPastePlugin,
    "imageNotices"
  );
  const [notice, setNotice] = useState("");
  const noticesSeen = useRef(imageNotices);
  // The panel paints colours as `.pe-rt-field [data-color]` reads them; the
  // canvas wears the public classes and the frame's theme.
  const paint = useMemo(
    () =>
      Object.fromEntries(
        swatches.map(({ paper, token }) => [`--pe-rt-${token}`, paper])
      ) as CSSProperties,
    [swatches]
  );

  useEffect(() => {
    if (editorRef) {
      editorRef.current = editor;
    }
  }, [editor, editorRef]);

  useEffect(() => {
    editor.setOption(
      RichKeysPlugin,
      "linkNeedsSelection",
      variant === "canvas"
    );
  }, [editor, variant]);

  // Pasted colours map to the page's swatches.
  useEffect(() => {
    editor.setOption(RichPastePlugin, "swatches", swatches);
  }, [editor, swatches]);

  useEffect(() => {
    editor.setOption(
      RichKeysPlugin,
      "emptyHistory",
      onPageHistory
        ? (step) => {
            forceTake.current = true;
            // The page's history holds the field's steps from here on: its
            // own would replay them out of order.
            editor.history.undos = [];
            editor.history.redos = [];
            onPageHistory(step);
          }
        : null
    );
  }, [editor, onPageHistory]);

  /** Takes the latest prop, if it changed; reads it now, never earlier. */
  const take = useCallback(() => {
    clearTimeout(takeTimer.current);
    if (pending.current) {
      pending.current = false;
      takeProp(editor, lastHtml, latestHtml.current);
    }
  }, [editor]);
  // mod+z and mod+shift+z take a pending outside change first, so the
  // page's undo reverts it and the field's own never writes over it.
  useEffect(() => {
    editor.setOption(RichKeysPlugin, "pendingTake", take);
  }, [editor, take]);
  /** Whether the toolbar's link input is open. */
  const linkInputOpen = useCallback(
    () => editor.getOption(RichKeysPlugin, "linkOpen"),
    [editor]
  );
  /**
   * Takes it once `TAKE_DELAY_MS` pass with no new prop, no focus and no
   * open link input. Nothing is scheduled while the input is open.
   */
  const takeLater = useCallback(() => {
    clearTimeout(takeTimer.current);
    if (linkInputOpen()) {
      return;
    }
    takeTimer.current = setTimeout(() => {
      if (!(editor.api.isFocused() || linkInputOpen())) {
        take();
      }
    }, TAKE_DELAY_MS);
  }, [editor, linkInputOpen, take]);

  useEffect(() => {
    latestHtml.current = html;
    // Its own echo (the exact string the field reported): nothing to parse,
    // and nothing left to take.
    pending.current = html !== lastHtml.current;
    if (forceTake.current && pending.current) {
      forceTake.current = false;
      take();
      return;
    }
    // A focused field keeps its text, and takes the prop on focus out.
    if (shouldTakeProp(html, lastHtml.current, editor.api.isFocused())) {
      takeLater();
    }
  }, [editor, html, take, takeLater]);

  // The link input closed: what came in while it was open is taken now.
  useEffect(() => {
    if (linkOpen) {
      linkWasOpen.current = true;
    } else if (linkWasOpen.current) {
      linkWasOpen.current = false;
      take();
    }
  }, [linkOpen, take]);

  useEffect(() => () => clearTimeout(takeTimer.current), []);

  // A paste dropped an image: say where images go, then take it back down.
  useEffect(() => {
    if (imageNotices <= noticesSeen.current) {
      return;
    }
    noticesSeen.current = imageNotices;
    setNotice(IMAGE_NOTICE);
    const timer = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [imageNotices]);

  const handleValueChange = ({ value }: { value: Value }) => {
    const next = htmlToEmit(value, lastHtml.current);
    if (next === null) {
      return;
    }
    forceTake.current = false;
    lastHtml.current = next;
    if (editor.getOption(RichKeysPlugin, "historyStep")) {
      onChange(next, { historyNeutral: true });
    } else {
      onChange(next);
    }
  };

  const surface =
    variant === "canvas"
      ? { className: RICH_CLASS, "data-rich-edit": "1" }
      : { className: "pe-rt-field", style: paint };

  // A toolbar press does not focus the editor, so it takes the pending prop
  // itself, before the command runs on the old text. A press in the open
  // link input leaves it for the input's close.
  const takeBeforeCommand = () => {
    if (!(editor.api.isFocused() || linkInputOpen())) {
      take();
    }
  };
  const takeAfterBlur = () => {
    forceTake.current = false;
    if (pending.current) {
      takeLater();
    }
  };

  // `onValueChange`, not `onChange`: a caret move changes no HTML. Focus
  // takes a pending prop before the first keystroke can build on old text;
  // focus out takes one that came in while the field was focused.
  return (
    <Plate editor={editor} onValueChange={handleValueChange}>
      {variant === "panel" ? (
        <div onMouseDownCapture={takeBeforeCommand}>
          <RichToolbar editor={editor} swatches={swatches} tone="paper" />
        </div>
      ) : null}
      <div className="pe-rt-wrap">
        <PlateContent
          aria-label={label}
          autoFocus={autoFocus}
          onBlur={takeAfterBlur}
          onFocus={take}
          {...surface}
        />
        <div className="pe-rt-notice" role="status">
          {notice}
        </div>
      </div>
      {variant === "canvas" ? (
        <div onMouseDownCapture={takeBeforeCommand}>
          <RichBubble editor={editor} swatches={swatches} />
        </div>
      ) : null}
    </Plate>
  );
}
