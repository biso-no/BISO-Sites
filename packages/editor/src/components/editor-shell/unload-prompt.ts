"use client";

import { useEffect } from "react";

function promptBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  // Older browsers only prompt when returnValue is set.
  event.returnValue = "";
}

/**
 * While `active`, closing or reloading the tab asks first. The shell turns it
 * on while edits exist only in memory: a save is pending or on its way, the
 * last one failed, or the theme blocks saving.
 */
export function useUnloadPrompt(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }
    window.addEventListener("beforeunload", promptBeforeUnload);
    return () => window.removeEventListener("beforeunload", promptBeforeUnload);
  }, [active]);
}
