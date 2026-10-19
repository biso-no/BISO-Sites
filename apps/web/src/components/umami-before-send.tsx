"use client";

import { UMAMI_BEFORE_SEND, umamiBeforeSend } from "@/lib/analytics-privacy";

// Installed when this module loads in the browser, which is before hydration
// and so before the `afterInteractive` Umami script is injected: the very
// first page view already goes through the hook. Umami reads it from `window`
// on every send.
if (typeof window !== "undefined") {
  Object.assign(window, { [UMAMI_BEFORE_SEND]: umamiBeforeSend });
}

/**
 * Renders nothing; the root layout renders it so the module above, which
 * installs Umami's `data-before-send` hook, loads on every page.
 */
export function UmamiBeforeSend() {
  return null;
}
