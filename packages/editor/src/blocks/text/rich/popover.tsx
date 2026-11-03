"use client";

import { useEditorRef } from "platejs/react";
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** What the toggle needs from the popover: spread it on the `<button>`. */
export interface PopoverButtonProps {
  "aria-expanded": boolean;
  "aria-haspopup": "true";
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
 * keyboard, the first item does. The menu closes when one of its items is chosen, on Escape inside it
 * (focus goes back to the toggle, and the key goes no further), on a press
 * anywhere outside it, and when keyboard focus leaves it.
 */
export function RichPopover({ button, children, label }: RichPopoverProps) {
  const editor = useEditorRef();
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

  // A click with no count is Enter or Space on the focused toggle.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    focusFirst.current = !open && event.detail === 0;
    setOpen(!open);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      toggle.current?.focus();
    }
  };

  const onBlur = (event: FocusEvent) => {
    if (open && isOutside(wrap.current, event.relatedTarget)) {
      setOpen(false);
    }
  };

  return (
    // The wrapper only hears what its buttons pass up: Escape, and focus
    // leaving them. It is no control itself.
    // biome-ignore lint/a11y/noStaticElementInteractions: key and focus events from its buttons, see above.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: key and focus events from its buttons, see above.
    <div
      className="pe-rt-popwrap"
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      ref={wrap}
    >
      {button({
        "aria-expanded": open,
        "aria-haspopup": "true",
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
