"use client";

import {
  flip,
  offset,
  shift,
  type UseVirtualFloatingOptions,
  useFloatingToolbar,
  useFloatingToolbarState,
} from "@platejs/floating";
import { type PlateEditor, useEventEditorValue } from "platejs/react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { RichKeysPlugin } from "./react-plugins";
import { RichToolbar } from "./toolbar";

/** Above the selection, below it when there is no room; inside the frame. */
const FLOATING: UseVirtualFloatingOptions = {
  middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  placement: "top",
};

/**
 * Whether focus is in the editor or in the bubble. Focus moving from one to
 * the other (into the style select or the link input) keeps it in: the
 * `focusout` names where focus goes. Plate's own focus state would drop for
 * that moment, and the bubble would unmount under the click.
 */
function useFocusWithin(
  editor: PlateEditor,
  bubble: RefObject<HTMLElement | null>
): boolean {
  const [within, setWithin] = useState(false);
  useEffect(() => {
    const inside = (target: EventTarget | null): boolean =>
      target instanceof Node &&
      Boolean(
        editor.api.toDOMNode(editor)?.contains(target) ||
          bubble.current?.contains(target)
      );
    const onFocusIn = (event: FocusEvent) => setWithin(inside(event.target));
    const onFocusOut = (event: FocusEvent) =>
      setWithin(inside(event.relatedTarget));
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
    };
  }, [bubble, editor]);
  return within;
}

/**
 * The canvas field's toolbar: a small dark bar over an expanded selection
 * while the editor (or the bubble itself) has focus, hidden otherwise.
 */
export function RichBubble({ editor }: { editor: PlateEditor }) {
  const bubble = useRef<HTMLDivElement | null>(null);
  const focused = useFocusWithin(editor, bubble);
  const state = useFloatingToolbarState({
    editorId: editor.id,
    floatingOptions: FLOATING,
    focusedEditorId: useEventEditorValue("focus"),
  });
  const { clickOutsideRef, hidden, props, ref } = useFloatingToolbar(state);
  const visible = focused && !hidden;
  const setBubble = useCallback(
    (node: HTMLDivElement | null) => {
      bubble.current = node;
      ref(node);
      clickOutsideRef(node);
    },
    [clickOutsideRef, ref]
  );

  // A link input left open would reappear with the next selection.
  useEffect(() => {
    if (!visible) {
      editor.setOption(RichKeysPlugin, "linkOpen", false);
    }
  }, [editor, visible]);

  if (!visible) {
    return null;
  }
  return (
    <div className="pe-rt-bubble" ref={setBubble} style={props.style}>
      <RichToolbar editor={editor} tone="ink" />
    </div>
  );
}
