import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { format } from "date-fns";
import { DollarSign, Info, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
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

function PriceHelperText({
  price,
  eventData,
  collectionCount,
}: {
  price: string;
  eventData: NonNullable<ContentTranslations["event_ref"]> | undefined;
  collectionCount: number;
}) {
  const t = useTranslations("events");
  const textClass = "text-muted-foreground text-sm";

  if (price === "Free") {
    return <p className={textClass}>{t("infoCards.freeEvent")}</p>;
  }

  if (eventData?.is_collection && eventData.collection_pricing === "bundle") {
    return (
      <p className={textClass}>
        {t("infoCards.bundleAccess", { count: collectionCount })}
      </p>
    );
  }

  if (
    eventData?.is_collection &&
    eventData.collection_pricing === "individual"
  ) {
    return <p className={textClass}>{t("infoCards.individualRegister")}</p>;
  }

  if (eventData?.collection_id) {
    return <p className={textClass}>{t("infoCards.partOfCollection")}</p>;
  }

  return <p className={textClass}>{t("infoCards.secureSpot")}</p>;
}

export function EventPriceCard({
  event,
  collectionCount = 0,
  isMember = false,
}: EventPriceCardProps) {
  const t = useTranslations("events");
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

  const getPriceLabel = () => {
    if (eventData?.is_collection) {
      if (eventData.collection_pricing === "bundle") {
        return t("infoCards.bundlePrice");
      }
      if (eventData.collection_pricing === "individual") {
        return t("infoCards.pricing");
      }
    }
    return t("infoCards.price");
  };

  return (
    <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 p-6 shadow-lg">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
          <DollarSign className="h-6 w-6 text-white" />
        </div>
        <div>
          <div className="text-muted-foreground text-sm">{getPriceLabel()}</div>
          <div className="font-bold text-foreground text-xl">
            {displayPrice}
          </div>
          {showMemberDiscount && (
            <div className="text-green-600 text-xs">
              {t("card.membersPrice", { price: memberPrice })}
            </div>
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
  const t = useTranslations("events");
  const eventData = event.event_ref;
  const metadata = parseEventMetadata(eventData?.metadata);
  const category = getEventCategory(metadata);
  const attendees = metadata.attendees || 0;

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

  return (
    <Card className="border-0 p-6 shadow-lg">
      <h3 className="mb-4 font-bold text-foreground">
        {t("infoCards.eventDetails")}
      </h3>
      <div className="space-y-4">
        <div>
          <div className="mb-1 text-muted-foreground text-sm">
            {t("modal.date")}
          </div>
          <div className="text-foreground">{startDate}</div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">
            {t("modal.time")}
          </div>
          <div className="text-foreground">{timeRange}</div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">
            {t("modal.location")}
          </div>
          <div className="text-foreground">
            {eventData?.location || t("card.locationTba")}
          </div>
        </div>
        <Separator />
        <div>
          <div className="mb-1 text-muted-foreground text-sm">
            {t("infoCards.category")}
          </div>
          <div className="text-foreground">{t(`filters.${category}`)}</div>
        </div>
        {attendees > 0 && (
          <>
            <Separator />
            <div>
              <div className="mb-1 text-muted-foreground text-sm">
                {t("infoCards.expectedAttendance")}
              </div>
              <div className="text-foreground">
                {t("card.attending", { count: attendees })}
              </div>
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
  const t = useTranslations("events");

  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">
            {t("infoCards.importantInfo")}
          </h4>
          <ul className="space-y-1 text-muted-foreground text-sm">
            <li>• {t("infoCards.arriveEarly")}</li>
            <li>• {t("infoCards.studentId")}</li>
            <li>• {t("infoCards.emailConfirmation")}</li>
            {price !== "Free" && <li>• {t("infoCards.refunds")}</li>}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export function EventContactCard() {
  const t = useTranslations("events");

  return (
    <Card className="border-0 bg-blue-50 p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h4 className="mb-2 font-semibold text-foreground">
            {t("infoCards.questions")}
          </h4>
          <p className="text-muted-foreground text-sm">
            {t("infoCards.contactTeam")}{" "}
            <a
              className="text-brand hover:underline"
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
