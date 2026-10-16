"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The front page's membership CTA, tracked.
 *
 * A client island for the same reason `partner-link.tsx` is one: the click is
 * reported and `trackEvent` needs `onClick`. Same event and `source` the v1
 * "Join us" block sent, so the conversion funnel keeps one series across the
 * redesign.
 */
export function JoinLink({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      className={className}
      href="/membership"
      onClick={() =>
        trackEvent("membership_cta_click", { source: "home_join_us" })
      }
    >
      {children}
    </Link>
  );
}
