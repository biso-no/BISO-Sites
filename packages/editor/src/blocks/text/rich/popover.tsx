"use client";

import { useEditorRef } from "platejs/react";
import {
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * What the toggle needs from the popover: spread it on the `<button>`. A
 * disclosure: `aria-expanded`, and `aria-controls` names the open menu.
 */
export interface PopoverButtonProps {
  "aria-controls": string | undefined;
  "aria-expanded": boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onMouseDown: (event: MouseEvent) => void;
  ref: RefObject<HTMLButtonElement | null>;
  type: "button";
}

interface RichPopoverProps {
  /** The toggle, given the props that open and close the popover. */
  button: (props: PopoverButtonProps) => ReactNode;
  /** The items, given `close`; `close(true)` hands focus to the editor. */
  children: (close: (focusEditor: boolean) => void) => ReactNode;
  label: string;
}

/** A press keeps focus where it is, so the editor keeps its selection. */
const keepSelection = (event: MouseEvent) => event.preventDefault();

const isOutside = (wrap: HTMLElement | null, target: EventTarget | null) =>
  !(target instanceof Node && wrap?.contains(target));

/**
 * Moves an open menu left by as much as it would stick out past the
 * toolbar's right edge. A menu under a button near the end of the panel's
 * toolbar would otherwise run past the panel and scroll it sideways.
 */
function keepInsideToolbar(menu: HTMLElement): void {
  const bar = menu.closest(".pe-rt-bar");
  if (!bar) {
    return;
  }
  const overflow =
    menu.getBoundingClientRect().right - bar.getBoundingClientRect().right;
  if (overflow > 0) {
    menu.style.left = `${-overflow}px`;
  }
}

/**
 * A toolbar button that opens a small menu under it, inside the toolbar's
 * width. A press, like every toolbar press, takes no focus; opened from the
 * keyboard, the first item does. The menu closes when one of its items is
 * chosen, on a press anywhere outside it, when keyboard focus leaves it, and
 * on Escape (see the listener below).
 */
export function RichPopover({ button, children, label }: RichPopoverProps) {
  const editor = useEditorRef();
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const focusFirst = useRef(false);

  const close = useCallback(
    (focusEditor: boolean) => {
      setOpen(false);
      if (focusEditor) {
        editor.tf.focus();
      }
    },
    [editor]
  );

  useLayoutEffect(() => {
    if (open && pop.current) {
      keepInsideToolbar(pop.current);
    }
  }, [open]);

  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false;
      pop.current
        ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
        ?.focus();
    }
  }, [open]);

  // Capture phase: a handler further down that stops the press must not
  // keep the menu open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPressOutside = (event: globalThis.MouseEvent) => {
      if (isOutside(wrap.current, event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPressOutside, true);
    return () =>
      document.removeEventListener("mousedown", onPressOutside, true);
  }, [open]);

  // Escape closes the menu wherever the editor's focus is: in the menu, or
  // still in the text after a press opened it. Focus goes back to the toggle
  // from the menu, to the text from the text, and the key goes no further,
  // so a view around the field stays open. Capture phase, on the document,
  // since the text keeps focus. Escape anywhere else is that control's own.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      const { target } = event;
      const inMenu = !isOutside(wrap.current, target);
      const inText =
        target instanceof Node &&
        Boolean(editor.api.toDOMNode(editor)?.contains(target));
      if (event.key !== "Escape" || !(inMenu || inText)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      if (inMenu) {
        toggle.current?.focus();
      } else {
        editor.tf.focus();
      }
    };
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [editor, open]);

  // A click with no count is Enter or Space on the focused toggle.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    focusFirst.current = !open && event.detail === 0;
    setOpen(!open);
  };

  const onBlur = (event: FocusEvent) => {
    if (open && isOutside(wrap.current, event.relatedTarget)) {
      setOpen(false);
    }
  };

  return (
    // The wrapper only hears focus leaving its buttons. It is no control
    // itself.
    // biome-ignore lint/a11y/noStaticElementInteractions: focus events from its buttons, see above.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: focus events from its buttons, see above.
    <div className="pe-rt-popwrap" onBlur={onBlur} ref={wrap}>
      {button({
        "aria-controls": open ? id : undefined,
        "aria-expanded": open,
        onClick,
        onMouseDown: keepSelection,
        ref: toggle,
        type: "button",
      })}
      {open ? (
        // A labelled group of toolbar buttons, as the toolbar's own
        // `role="toolbar"`; its press only keeps the editor's selection.
        // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form fields and brings its own box.
        // biome-ignore lint/a11y/noNoninteractiveElementInteractions: a press on its padding keeps the selection, see above.
        <div
          aria-label={label}
          className="pe-rt-pop"
          id={id}
          onMouseDown={keepSelection}
          ref={pop}
          role="group"
        >
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}
