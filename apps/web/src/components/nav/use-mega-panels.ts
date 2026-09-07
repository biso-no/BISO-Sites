"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { PanelId } from "./nav-config";

/**
 * Open/close behaviour for the mega-menu panels.
 *
 * **Extracted verbatim from `mega-nav.tsx` in RD-017, deliberately unchanged.**
 * This is the best-built thing in the current codebase and the redesign's job
 * was to restyle the header, not to rewrite its keyboard handling. Extracting
 * rather than copying means the old header and the new one run *the same code*,
 * so "preserved verbatim" is a fact about the module graph rather than a claim
 * about two files that happen to look alike.
 *
 * Four behaviours, all of which must keep working:
 *   - hover intent, with a 120ms grace period so a diagonal mouse path from
 *     trigger to panel does not close it
 *   - `ArrowDown` opens a panel and moves focus to its first link
 *   - `Escape` closes and returns focus to the trigger that opened it
 *   - pointer-down outside the nav closes any open panel
 *
 * The subtlety worth not losing: `handleTriggerFocus` opens on *keyboard* focus
 * only. The focus that follows a pointer click would otherwise race the click
 * toggle and immediately reclose the panel.
 */
const SCROLL_THRESHOLD = 50;
const CLOSE_DELAY_MS = 120;

export function useMegaPanels() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null);

  const navRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef<Record<PanelId, HTMLButtonElement | null>>({
    students: null,
    projects: null,
    about: null,
  });
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openPanelRef = useRef<PanelId | null>(null);
  const pointerInteractionRef = useRef(false);
  /**
   * Set immediately before Escape moves focus back to the trigger.
   *
   * Without it Escape does not work: `closeNow()` closes the panel, the
   * programmatic `.focus()` that follows fires `handleTriggerFocus`, and that
   * reopens it. Verified in RD-017 — focusing a trigger with no key events at
   * all opens its panel, so the close-then-refocus sequence was self-defeating.
   */
  const suppressFocusOpenRef = useRef(false);

  useEffect(() => {
    openPanelRef.current = openPanel;
  }, [openPanel]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openPanelNow = useCallback(
    (id: PanelId) => {
      clearCloseTimer();
      setOpenPanel(id);
    },
    [clearCloseTimer]
  );

  const closeNow = useCallback(() => {
    clearCloseTimer();
    setOpenPanel(null);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(
      () => setOpenPanel(null),
      CLOSE_DELAY_MS
    );
  }, [clearCloseTimer]);

  const togglePanel = useCallback(
    (id: PanelId) => {
      clearCloseTimer();
      // Fire only on the open transition, never on close.
      if (openPanelRef.current !== id) {
        trackEvent("nav_menu_open", { panel: id });
      }
      setOpenPanel((current) => (current === id ? null : id));
      pointerInteractionRef.current = false;
    },
    [clearCloseTimer]
  );

  const handleTriggerPointerDown = useCallback(() => {
    pointerInteractionRef.current = true;
  }, []);

  const handleTriggerFocus = useCallback(
    (id: PanelId) => {
      // The refocus that Escape performs must not reopen what Escape closed.
      if (suppressFocusOpenRef.current) {
        suppressFocusOpenRef.current = false;
        return;
      }
      // Open only on keyboard focus, not the focus that follows a pointer click
      // (which would race the click toggle and immediately reclose the panel).
      if (!pointerInteractionRef.current) {
        openPanelNow(id);
      }
    },
    [openPanelNow]
  );

  const focusFirstPanelLink = useCallback((id: PanelId) => {
    requestAnimationFrame(() => {
      const panel = document.getElementById(`nav-panel-${id}`);
      panel?.querySelector<HTMLElement>("a, button")?.focus();
    });
  }, []);

  const handleTriggerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, id: PanelId) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        openPanelNow(id);
        focusFirstPanelLink(id);
      } else if (event.key === "Escape") {
        closeNow();
      }
    },
    [openPanelNow, focusFirstPanelLink, closeNow]
  );

  const registerTrigger = useCallback(
    (id: PanelId, el: HTMLButtonElement | null) => {
      triggerRefs.current[id] = el;
    },
    []
  );

  // Sticky/scroll background.
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Escape closes the panel + returns focus to its trigger; pointer-down outside
  // the nav root closes any open panel.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const current = openPanelRef.current;
      if (event.key === "Escape" && current) {
        suppressFocusOpenRef.current = true;
        closeNow();
        triggerRefs.current[current]?.focus();
      }
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        openPanelRef.current &&
        navRef.current &&
        !navRef.current.contains(event.target as Node)
      ) {
        closeNow();
      }
    };
    // Pointer or focus leaving the header closes an open panel. Attached to
    // the nav node here rather than as JSX props on the element: a mouse
    // handler on a landmark or a plain <div> trips
    // `a11y/noNoninteractiveElementInteractions`, and rightly so — the
    // keyboard equivalent is what makes it acceptable, and both belong beside
    // the rest of the panel behaviour rather than scattered through markup.
    //
    // `focusout` is the keyboard counterpart to `mouseleave`: without it a
    // keyboard user who tabs past the header leaves the panel hanging open
    // until they press Escape. `relatedTarget` keeps it from firing on focus
    // moves *within* the header.
    const nav = navRef.current;
    const handleMouseLeave = () => scheduleClose();
    const handleFocusOut = (event: FocusEvent) => {
      if (!nav?.contains(event.relatedTarget as Node | null)) {
        scheduleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    nav?.addEventListener("mouseleave", handleMouseLeave);
    nav?.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      nav?.removeEventListener("mouseleave", handleMouseLeave);
      nav?.removeEventListener("focusout", handleFocusOut);
    };
  }, [closeNow, scheduleClose]);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  return {
    navRef,
    openPanel,
    isScrolled,
    clearCloseTimer,
    closeNow,
    scheduleClose,
    togglePanel,
    handleTriggerPointerDown,
    handleTriggerFocus,
    handleTriggerKeyDown,
    openPanelNow,
    registerTrigger,
  };
}
