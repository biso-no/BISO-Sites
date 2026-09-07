"use client";

import type { AnalyticsEventName } from "@repo/shared/utils/analytics";
import { trackEvent } from "@repo/shared/utils/analytics";
import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CONFIRM_MS = 2000;

/**
 * The one interactive control in a redesigned detail header, and therefore the
 * only part of it that ships as a Client Component. The v1 job page made its
 * entire 368-line view a client component to get this single button; the v1
 * event page did the same for its share button.
 *
 * Labels are props rather than a namespace lookup so the button belongs to no
 * one feature — the server component rendering it already has a translator.
 *
 * The confirmation is announced, not just shown: `aria-live` means a screen
 * reader hears "Link copied" rather than watching an icon it cannot see swap.
 *
 * `shareTitle` opts into the platform share sheet where one exists, which on a
 * phone is what someone actually wants; everywhere else it falls back to the
 * same clipboard copy, so the control never advertises something it cannot do.
 */
export interface CopyLinkButtonProps {
  copiedLabel: string;
  copyLabel: string;
  /** When set and `navigator.share` exists, opens the share sheet instead. */
  shareTitle?: string;
  /**
   * Optional analytics event, so a page that measured its share control before
   * does not lose the metric by adopting this one. The name is the strict
   * `AnalyticsEventName` union, and the props are plain strings — nothing here
   * crosses the server boundary that could not be serialized.
   */
  track?: { event: AnalyticsEventName; props?: Record<string, string> };
}

export function CopyLinkButton({
  copyLabel,
  copiedLabel,
  shareTitle,
  track,
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    []
  );

  const activate = async () => {
    if (track) {
      trackEvent(track.event, track.props);
    }
    const url = window.location.href;
    if (shareTitle && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: shareTitle, url });
      } catch {
        // Dismissing the share sheet rejects. That is not a failure, and it
        // must not fall through to a "copied" confirmation nobody asked for.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch {
      // Clipboard access can be denied (insecure origin, permission policy).
      // The URL is in the address bar either way, so there is nothing to
      // recover — just don't claim success.
    }
  };

  const idleIcon = shareTitle ? Share2 : Link2;
  const Icon = copied ? Check : idleIcon;

  return (
    <button
      className="inline-flex shrink-0 items-center gap-2 rounded-biso-sm px-3 py-2 text-current/80 transition-colors hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      onClick={activate}
      type="button"
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span aria-live="polite" className="type-label">
        {copied ? copiedLabel : copyLabel}
      </span>
    </button>
  );
}
