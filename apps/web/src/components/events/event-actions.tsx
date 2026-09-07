"use client";

import type { Events } from "@repo/api/types/appwrite";
import { trackEvent } from "@repo/shared/utils/analytics";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { format } from "date-fns";
import { CalendarCheck, ExternalLink, Share2, Ticket } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  type EventRegistrationInfo,
  resolveEventRegistration,
} from "@/lib/types/event";

interface EventActionsProps {
  description: string;
  event: Events;
  title: string;
}

function RegistrationHeading({
  registration,
}: {
  registration: EventRegistrationInfo;
}) {
  const t = useTranslations("events");

  if (registration.mode === "ticket") {
    return (
      <>
        <h3 className="mb-4 font-bold text-white text-xl">
          {t("actions.getTicket")}
        </h3>
        <p className="mb-6 text-sm text-white/90">
          {t("actions.ticketDescription")}
        </p>
      </>
    );
  }

  if (registration.mode === "expected") {
    return (
      <>
        <h3 className="mb-4 font-bold text-white text-xl">
          {t("actions.registrationRequired")}
        </h3>
        <p className="mb-6 text-sm text-white/90">
          {t("actions.registrationPendingDescription")}
        </p>
      </>
    );
  }

  return (
    <>
      <h3 className="mb-4 flex items-center gap-2 font-bold text-white text-xl">
        <CalendarCheck aria-hidden className="h-5 w-5" />
        {t("actions.noRegistrationTitle")}
      </h3>
      <p className="mb-6 text-sm text-white/90">
        {t("actions.noRegistrationDescription")}
      </p>
    </>
  );
}

/**
 * Deadline/capacity facts, shown in place of a CTA when registration is
 * expected but there is no `ticket_url` to send the student to.
 */
function RegistrationFacts({
  registration,
}: {
  registration: EventRegistrationInfo;
}) {
  const t = useTranslations("events");

  if (registration.mode !== "expected") {
    return null;
  }

  const deadlineLabel = registration.deadline
    ? format(new Date(registration.deadline), "d MMM yyyy, HH:mm")
    : null;

  return (
    <ul className="mb-3 space-y-1 text-sm text-white/90">
      {deadlineLabel && (
        <li>• {t("actions.registrationDeadline", { date: deadlineLabel })}</li>
      )}
      {registration.capacity !== null && (
        <li>
          • {t("actions.capacityLimited", { count: registration.capacity })}
        </li>
      )}
    </ul>
  );
}

export function EventActions({ event, title, description }: EventActionsProps) {
  const t = useTranslations("events");
  const pathname = usePathname();
  // The event detail route is /events/[slug]; the trailing segment is the slug.
  const eventId = pathname.split("/").pop() ?? "";
  const registration = resolveEventRegistration(event);

  const handleShare = async () => {
    trackEvent("share", { type: "event", eventId });
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: window.location.href,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  return (
    <Card className="border-0 bg-linear-to-br from-brand-gradient-to to-brand-gradient-from p-6 shadow-lg">
      <RegistrationHeading registration={registration} />

      {/* Only `ticket` has somewhere to send the student — the other modes get
          information, never a button that does nothing when clicked. */}
      {registration.ticketUrl && (
        <Button
          className="mb-3 w-full bg-background text-brand-dark hover:bg-background/90"
          onClick={() => {
            trackEvent("event_ticket_click", { eventId });
            window.open(registration.ticketUrl ?? "", "_blank");
          }}
        >
          <Ticket className="mr-2 h-4 w-4" />
          {t("actions.buyOnTickster")}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      )}

      <RegistrationFacts registration={registration} />

      <Button
        className="w-full border-white text-white hover:bg-background/10"
        onClick={handleShare}
        variant="outline"
      >
        <Share2 className="mr-2 h-4 w-4" />
        {t("actions.shareEvent")}
      </Button>
    </Card>
  );
}
