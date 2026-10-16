"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import type { ReactNode } from "react";

/**
 * Wraps a partner logo in its outbound link.
 *
 * A client island for the same reason `footer-social.tsx` is one: the link is
 * tracked and `trackEvent` needs `onClick`. The logo itself is passed in as
 * `children`, so it stays server-rendered and only the anchor ships.
 *
 * The v1 homepage linked partners that carry a `url` and tracked the click; the
 * redesign rendered the image alone, so a partner's logo became decoration. PR
 * review caught it.
 */
export function PartnerLink({
  children,
  name,
  url,
}: {
  children: ReactNode;
  name: string;
  url: string;
}) {
  return (
    <a
      className="block rounded-biso-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      href={url}
      onClick={() =>
        trackEvent("outbound_click", {
          url,
          label: name,
          surface: "partners",
        })
      }
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}
