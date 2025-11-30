import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { format } from "date-fns";
import { Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { formatEventPrice } from "@/lib/types/event";

type EventCollectionListProps = {
  currentEventId: string;
  collectionEvents: ContentTranslations[];
  isCollectionParent: boolean;
  collectionPricing: string | null;
  priceDisplay: string;
};

export function EventCollectionList({
  currentEventId,
  collectionEvents,
  isCollectionParent,
  collectionPricing,
  priceDisplay,
}: EventCollectionListProps) {
  if (!collectionEvents || collectionEvents.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/5 to-[#001731]/5 p-8 shadow-lg">
      <div className="mb-6 flex items-start justify-between">
        <h2 className="font-bold text-2xl text-gray-900">
          {isCollectionParent
            ? "Events in This Collection"
            : "Other Events in This Collection"}
        </h2>
        {isCollectionParent && collectionPricing === "bundle" && (
          <Badge className="border-green-200 bg-green-100 text-green-700">
            Bundle Pricing
          </Badge>
        )}
        {isCollectionParent && collectionPricing === "individual" && (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700">
            Individual Pricing
          </Badge>
        )}
      </div>

      {isCollectionParent && collectionPricing === "bundle" && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-gray-700 text-sm">
            <strong>Bundle Pricing:</strong> Pay {priceDisplay} once to get
            access to all {collectionEvents.length} events in this collection.
          </p>
        </div>
      )}

      {isCollectionParent && collectionPricing === "individual" && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-gray-700 text-sm">
            <strong>Individual Pricing:</strong> Each event can be registered
            for separately. Choose the events that interest you most!
          </p>
        </div>
      )}

      <div className="space-y-4">
        {collectionEvents
          .filter((e) => e.$id !== currentEventId)
          .map((collectionEvent) => {
            const colEventData = collectionEvent.event_ref;
            const colStartDate = colEventData?.start_date
              ? format(new Date(colEventData.start_date), "MMMM d, yyyy")
              : "TBA";
            const colStartTime = colEventData?.start_date
              ? format(new Date(colEventData.start_date), "HH:mm")
              : "";
            const colEndTime = colEventData?.end_date
              ? format(new Date(colEventData.end_date), "HH:mm")
              : "";
            const colTimeRange =
              colStartTime && colEndTime
                ? `${colStartTime} - ${colEndTime}`
                : colStartTime || "TBA";
            const colPrice = formatEventPrice(colEventData?.price);
            const colImage =
              colEventData?.image ||
              "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

            return (
              <Link
                href={`/events/${collectionEvent.content_id}`}
                key={collectionEvent.$id}
              >
                <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start gap-4">
                    <div className="relative h-20 w-20 shrink-0">
                      <ImageWithFallback
                        alt={collectionEvent.title}
                        className="rounded-lg object-cover"
                        fill
                        src={colImage}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {collectionEvent.title}
                        </h3>
                        {collectionPricing === "individual" && (
                          <span className="whitespace-nowrap font-medium text-[#3DA9E0] text-sm">
                            {colPrice}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-gray-600 text-sm">
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
              </Link>
            );
          })}
      </div>
    </Card>
  );
}
