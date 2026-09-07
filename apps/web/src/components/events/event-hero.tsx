import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  EVENT_CATEGORY_COLORS,
  EVENT_CATEGORY_MESSAGE_KEYS,
  parseEventMetadata,
  resolveEventCategory,
} from "@/lib/types/event";

interface EventHeroProps {
  event: Events;
}

export function EventHero({ event }: EventHeroProps) {
  const t = useTranslations("events");
  const eventData = event;
  const translation = Array.isArray(event.translation_refs)
    ? event.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;
  const title = translation?.title ?? "Untitled";
  const metadata = parseEventMetadata(eventData?.metadata);
  const category = resolveEventCategory(eventData);

  // Format dates
  const startDate = eventData?.start_date
    ? format(new Date(eventData.start_date), "MMMM d, yyyy")
    : t("card.tba");

  const startTime = eventData?.start_date
    ? format(new Date(eventData.start_date), "HH:mm")
    : "";

  const endTime = eventData?.end_date
    ? format(new Date(eventData.end_date), "HH:mm")
    : "";

  const timeRange =
    startTime && endTime
      ? `${startTime} - ${endTime}`
      : startTime || t("card.tba");

  const attendees = metadata.attendees || 0;
  const imageUrl = eventData?.image || PLACEHOLDER_IMAGE;

  return (
    <div className="relative h-[50vh] overflow-hidden">
      <ImageWithFallback
        alt={title}
        className="object-cover"
        fill
        priority
        src={imageUrl}
      />
      <div className="absolute inset-0 bg-linear-to-br from-brand-overlay-from via-brand-overlay-via to-brand-overlay-to" />

      <div className="absolute inset-0">
        <div className="mx-auto flex h-full max-w-5xl items-center px-4">
          <Link
            className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-brand"
            href="/events"
          >
            <ArrowLeft className="h-5 w-5" />
            {t("hero.backToEvents")}
          </Link>

          <div className="fade-in slide-in-from-bottom-4 mt-12 animate-in duration-700">
            {category && (
              <Badge className={`mb-4 ${EVENT_CATEGORY_COLORS[category]}`}>
                {t(`filters.${EVENT_CATEGORY_MESSAGE_KEYS[category]}`)}
              </Badge>
            )}
            <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
              {title}
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-white/90">
                <Calendar className="h-5 w-5 text-brand" />
                <span>{startDate}</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <Clock className="h-5 w-5 text-brand" />
                <span>{timeRange}</span>
              </div>
              <div className="flex items-center gap-2 text-white/90">
                <MapPin className="h-5 w-5 text-brand" />
                <span>{eventData?.location || t("card.locationTba")}</span>
              </div>
              {attendees > 0 && (
                <div className="flex items-center gap-2 text-white/90">
                  <Users className="h-5 w-5 text-brand" />
                  <span>{t("card.attending", { count: attendees })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
