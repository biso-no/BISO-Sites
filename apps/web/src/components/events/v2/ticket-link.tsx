"use client";

import { trackEvent } from "@repo/shared/utils/analytics";
import { Ticket } from "lucide-react";

/**
 * The event page's ticket link — the one thing on the action card a visitor
 * clicks through to buy.
 *
 * A client island only for the `event_ticket_click` event the v1 page sent and
 * main still measures; the card around it stays a Server Component. Tracking
 * never cancels the navigation, so losing the script loses the metric only.
 */
export function TicketLink({
  eventId,
  href,
  label,
}: {
  /** The event's slug, as the v1 page reported it. */
  eventId: string;
  href: string;
  label: string;
}) {
  return (
    <a
      className="type-label inline-flex w-full items-center justify-center gap-2 rounded-biso-sm bg-action px-4 py-3 text-action-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      href={href}
      onClick={() => trackEvent("event_ticket_click", { eventId })}
      rel="noopener"
      target="_blank"
    >
      <Ticket aria-hidden="true" className="h-4 w-4" />
      {label}
    </a>
  );
}
