"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";

const EXCLUDED_PREFIX = "/scan";

/**
 * Umami records `location` (the full URL, including path) for every page
 * view. The guest scanner route carries a live bearer token in its path
 * (`/scan/<token>`), so that route must never load the analytics script —
 * otherwise the token lands in the analytics DB. Every other route keeps
 * tracking as before.
 */
export function AnalyticsScript() {
  const pathname = usePathname();
  if (
    pathname === EXCLUDED_PREFIX ||
    pathname.startsWith(`${EXCLUDED_PREFIX}/`)
  ) {
    return null;
  }
  return (
    <Script
      data-website-id="fb30735f-bf07-409f-bc65-f32baf0b17fd"
      defer
      src="https://analytics.biso.no/script.js"
      strategy="afterInteractive"
    />
  );
}
