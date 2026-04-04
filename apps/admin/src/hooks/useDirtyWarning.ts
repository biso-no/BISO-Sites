"use client";

import { useEffect } from "react";

type UseDirtyWarningOptions = {
  isDirty: boolean;
  isSubmitting: boolean;
  message?: string;
};

/**
 * Shows a browser confirmation dialog when the user tries to navigate
 * away with unsaved changes.
 *
 * Works for:
 * - Browser tab close / refresh (beforeunload)
 * - Browser back/forward buttons
 */
export function useDirtyWarning({
  isDirty,
  isSubmitting,
  message = "You have unsaved changes. If you leave, your changes will be lost.",
}: UseDirtyWarningOptions) {
  const shouldWarn = isDirty && !isSubmitting;

  useEffect(() => {
    if (!shouldWarn) {
      return;
    }

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome requires returnValue to be set
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldWarn, message]);
}
