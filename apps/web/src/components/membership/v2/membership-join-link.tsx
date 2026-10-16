"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A link into the purchase flow that reports the click.
 *
 * The membership page has always counted its join clicks as
 * `membership_cta_click` with `source: "membership_page"` — the funnel's first
 * step. The page itself renders on the server; this link is its only client
 * code, so the event survives without shipping the page to the browser.
 */
export function MembershipJoinLink({
  campus,
  children,
  className,
}: {
  campus: string | null;
  children: ReactNode;
  className: string;
}) {
  return (
    <Link
      className={className}
      href="/membership/join"
      onClick={() =>
        trackEvent("membership_cta_click", {
          campus: campus ?? undefined,
          source: "membership_page",
        })
      }
    >
      {children}
    </Link>
  );
}
