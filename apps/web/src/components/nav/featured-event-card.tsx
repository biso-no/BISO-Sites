"use client";

import { formatOsloDate } from "@repo/shared/utils/oslo-time";
import { ImageWithFallback } from "@repo/ui/components/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import type { NavFeaturedItem } from "@/lib/types/nav";

interface FeaturedEventCardProps {
  event: NavFeaturedItem;
  onNavigate: () => void;
}

/**
 * The next event, in the "For students" panel.
 *
 * The date is shown in Oslo wall-clock time whatever zone the browser runs in
 * (the stored value is a UTC instant), in the reader's language. An event
 * without a picture is shown without a frame rather than with a stock
 * placeholder.
 */
export function FeaturedEventCard({
  event,
  onNavigate,
}: FeaturedEventCardProps) {
  const t = useTranslations("common.navigation");
  const locale = useLocale();

  const formattedDate = formatOsloDate(
    event.startDate,
    { day: "numeric", month: "short", year: "numeric" },
    locale === "no" ? "nb-NO" : "en-GB"
  );

  return (
    <Link
      className="group block rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
      href={`/events/${event.slug}`}
      onClick={onNavigate}
    >
      {event.image ? (
        <ChevronFrame className="mb-3 bg-surface-sunken" ratio="16/9">
          {/* `alt=""`: the title below is the link's accessible name. */}
          <ImageWithFallback
            alt=""
            className="transition-transform duration-500 group-hover:scale-[1.03]"
            height={360}
            sizes="300px"
            src={event.image}
            width={640}
          />
        </ChevronFrame>
      ) : null}
      <span className="type-label block text-ink-accent">
        {t("featured.eventLabel")}
      </span>
      <span className="type-heading-card mt-1 line-clamp-2 block text-ink transition-colors group-hover:text-ink-accent">
        {event.title}
      </span>
      {formattedDate && event.startDate ? (
        <time
          className="type-data mt-1 block text-ink-muted"
          dateTime={event.startDate}
        >
          {formattedDate}
        </time>
      ) : null}
    </Link>
  );
}
