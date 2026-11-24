"use client";

import { useEffect, useRef } from "react";

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/** True when the key press belongs to a field the visitor is typing in. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  if (TYPING_TAGS.has(target.tagName)) {
    return true;
  }
  return (
    target.closest('[contenteditable]:not([contenteditable="false"])') !== null
  );
}

/** Open layers that own the keyboard: dialogs (the cart, a form) and menus. */
const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

/** True when the key press comes from inside an open dialog, menu or listbox. */
function isInsideOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OVERLAY_SELECTOR) !== null;
}

/**
 * `/` and Ctrl/Cmd+K open search. `/` may carry Shift, because a Norwegian
 * keyboard types it as Shift+7; any other modifier means some other shortcut.
 * Ctrl/Cmd+K takes no other modifier. Both stay out of the way while the
 * visitor types in a field or works in a dialog or menu, or when another
 * handler already took the key.
 */
function isSearchShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing) {
    return false;
  }
  if (isTypingTarget(event.target) || isInsideOverlay(event.target)) {
    return false;
  }
  if (event.key === "/") {
    return !(event.altKey || event.ctrlKey || event.metaKey);
  }
  // Chrome's autofill dispatches keydown events with no `key` at all.
  if (event.key?.toLowerCase() === "k") {
    return (
      (event.ctrlKey || event.metaKey) && !(event.altKey || event.shiftKey)
    );
  }
  return false;
}

/** Calls `onOpen` when the visitor presses a search shortcut anywhere on the page. */
export function useSearchShortcut(onOpen: () => void): void {
  // Read through a ref so a new callback each render does not re-bind.
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event)) {
        return;
      }
      // Keep the / out of the field that opens, Firefox's quick find and the
      // browser's own Ctrl+K.
      event.preventDefault();
      onOpenRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
