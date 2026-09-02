import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { PLACEHOLDER_IMAGE } from "@repo/ui/lib/placeholder-images";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatEventPrice, getEventHref } from "@/lib/types/event";

interface CollectionEventCardProps {
  collectionEvent: Events;
  collectionPricing: string | null;
}

function CollectionEventCard({
  collectionEvent,
  collectionPricing,
}: CollectionEventCardProps) {
  const t = useTranslations("events");

  const translation = Array.isArray(collectionEvent.translation_refs)
    ? collectionEvent.translation_refs.find(
        (item): item is ContentTranslations =>
          typeof item === "object" && item !== null && "title" in item
      )
    : null;
  const colStartDate = collectionEvent.start_date
    ? format(new Date(collectionEvent.start_date), "MMMM d, yyyy")
    : t("card.tba");
  const colStartTime = collectionEvent.start_date
    ? format(new Date(collectionEvent.start_date), "HH:mm")
    : "";
  const colEndTime = collectionEvent.end_date
    ? format(new Date(collectionEvent.end_date), "HH:mm")
    : "";
  const colTimeRange =
    colStartTime && colEndTime
      ? `${colStartTime} - ${colEndTime}`
      : colStartTime || t("card.tba");
  const colPrice = formatEventPrice(
    collectionEvent.price,
    collectionEvent.ticket_url
  );
  const colImage = collectionEvent.image || PLACEHOLDER_IMAGE;
  // The detail route resolves by slug, not $id. `slug` is optional in the
  // schema, so a row without one renders as a plain, unlinked card rather than
  // a link to a 404.
  const colHref = getEventHref(collectionEvent);

  const card = (
    <Card
      className={
        colHref ? "cursor-pointer p-4 transition-shadow hover:shadow-md" : "p-4"
      }
    >
      <div className="flex items-start gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <ImageWithFallback
            alt={translation?.title ?? "Event"}
            className="rounded-lg object-cover"
            fill
            src={colImage}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">
              {translation?.title ?? "Untitled"}
            </h3>
            {collectionPricing === "individual" && (
              <span className="whitespace-nowrap font-medium text-brand text-sm">
                {colPrice}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-muted-foreground text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{colStartDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{colTimeRange}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  if (!colHref) {
    return card;
  }

  return <Link href={colHref}>{card}</Link>;
}

interface EventCollectionListProps {
  collectionEvents: Events[];
  collectionPricing: string | null;
  currentEventId: string;
  isCollectionParent: boolean;
  priceDisplay: string;
}

export function EventCollectionList({
  currentEventId,
  collectionEvents,
  isCollectionParent,
  collectionPricing,
  priceDisplay,
}: EventCollectionListProps) {
  const t = useTranslations("events");

  if (!collectionEvents || collectionEvents.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 bg-linear-to-br from-brand-muted to-brand-muted p-8 shadow-lg">
      <div className="mb-6 flex items-start justify-between">
        <h2 className="font-bold text-2xl text-foreground">
          {isCollectionParent
            ? t("collection.title")
            : t("collection.otherTitle")}
        </h2>
        {isCollectionParent && collectionPricing === "bundle" && (
          <Badge className="border-green-200 bg-green-100 text-green-700">
            {t("collection.bundlePricing")}
          </Badge>
        )}
        {isCollectionParent && collectionPricing === "individual" && (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700">
            {t("collection.individualPricing")}
          </Badge>
        )}
      </div>

      {isCollectionParent && collectionPricing === "bundle" && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-muted-foreground text-sm">
            {t("collection.bundleDescription", {
              price: priceDisplay,
              count: collectionEvents.length,
            })}
          </p>
        </div>
      )}

      {isCollectionParent && collectionPricing === "individual" && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-muted-foreground text-sm">
            {t("collection.individualDescription")}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {collectionEvents
          .filter((e) => e.$id !== currentEventId)
          .map((collectionEvent) => (
            <CollectionEventCard
              collectionEvent={collectionEvent}
              collectionPricing={collectionPricing}
              key={collectionEvent.$id}
            />
          ))}
      </div>
    </Card>
  );
}
