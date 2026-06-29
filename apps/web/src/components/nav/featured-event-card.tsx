"use client";

import { ImageWithFallback } from "@repo/ui/components/image";
import { Card } from "@repo/ui/components/ui/card";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { NavFeaturedItem } from "@/lib/types/nav";

interface FeaturedEventCardProps {
  event: NavFeaturedItem;
  onNavigate: () => void;
}

export function FeaturedEventCard({
  event,
  onNavigate,
}: FeaturedEventCardProps) {
  const t = useTranslations("common.navigation");

  const formattedDate = event.startDate
    ? format(new Date(event.startDate), "d. MMM yyyy")
    : null;

  return (
    <Link href={`/events/${event.slug}`} onClick={onNavigate}>
      <Card className="group overflow-hidden border-brand-border bg-brand-muted/40 transition-colors hover:border-brand">
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <ImageWithFallback
            alt={event.title}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            fill
            sizes="320px"
            src={event.image || PLACEHOLDER_IMAGE}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        </div>
        <div className="space-y-1 p-4">
          <span className="font-semibold text-[11px] text-brand uppercase tracking-wide">
            {t("featured.eventLabel")}
          </span>
          <h4 className="line-clamp-2 font-semibold text-sm text-white">
            {event.title}
          </h4>
          {formattedDate && (
            <span className="flex items-center gap-1.5 text-white/70 text-xs">
              <CalendarDays aria-hidden className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
