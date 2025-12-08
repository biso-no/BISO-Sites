import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { format } from "date-fns";
import { DollarSign, Info, Mail } from "lucide-react";
import {
  formatEventPrice,
  getEventCategory,
  parseEventMetadata,
} from "@/lib/types/event";

type EventPriceCardProps = {
  event: ContentTranslations;
  collectionCount?: number;
  isMember?: boolean;
};

function getPriceLabel(
  isCollection: boolean | undefined,
  collectionPricing: string | null | undefined
) {
  if (isCollection) {
    if (collectionPricing === "bundle") {
      return "Bundle Price";
    }
    if (collectionPricing === "individual") {
      return "Pricing";
    }
  }
  return "Price";
}

function PriceHelperText({
  price,
  eventData,
  collectionCount,
}: {
  price: string;
  eventData: NonNullable<ContentTranslations["event_ref"]> | undefined;
  collectionCount: number;
}) {
  const textClass = "text-muted-foreground text-sm";

  if (price === "Free") {
    return <p className={textClass}>This event is free for all students!</p>;
  }

  if (eventData?.is_collection && eventData.collection_pricing === "bundle") {
    return (
      <p className={textClass}>
        One payment gives you access to all {collectionCount} events in this
        collection!
      </p>
    );
  }

  if (
    eventData?.is_collection &&
    eventData.collection_pricing === "individual"
  ) {
    return (
      <p className={textClass}>
        Register for individual events separately based on your interests.
      </p>
    );
  }

  if (eventData?.collection_id) {
    return (
      <p className={textClass}>
        This event is part of a collection. Check collection details for bundle
        pricing.
      </p>
    );
  }

  return <p className={textClass}>Secure your spot with online payment.</p>;
}

export function EventPriceCard({
  event,
  collectionCount = 0,
  isMember = false,
}: EventPriceCardProps) {
  const eventData = event.event_ref;
  const metadata = parseEventMetadata(eventData?.metadata);

  // Format price
  const price = formatEventPrice(eventData?.price);
  const memberPrice = metadata.member_price
    ? formatEventPrice(metadata.member_price)
    : null;

  // Display price logic
  const displayPrice = isMember && memberPrice ? memberPrice : price;
  const showMemberDiscount = !isMember && memberPrice;

  const priceLabel = getPriceLabel(
    eventData?.is_collection,
    eventData?.collection_pricing
  );

  return (
    <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
          <DollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-muted-foreground text-sm">{priceLabel}</div>
          <div className="font-bold text-foreground text-xl">{displayPrice}</div>
          {showMemberDiscount && (
            <div className="text-green-600 text-xs">Members: {memberPrice}</div>
          )}
        </div>
      </div>
      <PriceHelperText
        collectionCount={collectionCount}
        eventData={eventData}
        price={price}
      />
    </Card>
  );
}

type EventDetailsCardProps = {
  event: ContentTranslations;
};

export function EventDetailsCard({ event }: EventDetailsCardProps) {
  const eventData = event.event_ref;
  const metadata = parseEventMetadata(eventData?.metadata);
  const category = getEventCategory(metadata);
  const attendees = metadata.attendees || 0;

  // Format dates
  const startDate = eventData?.start_date
    ? format(new Date(eventData.start_date), "MMMM d, yyyy")
    : "TBA";

  const startTime = eventData?.start_date
    ? format(new Date(eventData.start_date), "HH:mm")
    : "";

  const endTime = eventData?.end_date
    ? format(new Date(eventData.end_date), "HH:mm")
    : "";

  const timeRange =
    startTime && endTime ? `${startTime} - ${endTime}` : startTime || "TBA";

  return (
    <Card className="border-0 p-6 shadow-lg">
      <h3 className="mb-4 font-bold text-foreground">Event Details</h3>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-muted-foreground text-sm">Date</div>
          <div className="text-foreground">{startDate}</div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">Time</div>
          <div className="text-foreground">{timeRange}</div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">Location</div>
          <div className="text-foreground">
            {eventData?.location || "Location TBA"}
          </div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">Category</div>
          <div className="text-foreground">{category}</div>
        </div>
        {attendees > 0 && (
          <>
            <Separator />
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                Expected Attendance
              </div>
              <div className="text-foreground">{attendees} students</div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

type EventImportantInfoCardProps = {
  price: string;
};

export function EventImportantInfoCard({ price }: EventImportantInfoCardProps) {
  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">
            Important Information
          </h4>
          <ul className="space-y-1 text-muted-foreground text-sm">
            <li>• Please arrive 15 minutes before the event starts</li>
            <li>• Valid student ID required for entry</li>
            <li>• Registration confirmation will be sent via email</li>
            {price !== "Free" && (
              <li>• Refunds available up to 48 hours before the event</li>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export function EventContactCard() {
  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">Questions?</h4>
          <p className="text-muted-foreground text-sm">
            Contact our events team at{" "}
            <a
              className="text-[#3DA9E0] hover:underline"
              href="mailto:events@biso.no"
            >
              events@biso.no
            </a>
          </p>
        </div>
      </div>
    </Card>
  );
}
