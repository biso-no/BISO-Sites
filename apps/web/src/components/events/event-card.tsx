"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { format } from "date-fns";
import {
  ArrowRight,
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  MapPin,
  Tag,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import {
  type EventCategory,
  formatEventPrice,
  getEventCategory,
  parseEventMetadata,
} from "@/lib/types/event";

type EventCardProps = {
  event: ContentTranslations;
  index: number;
  isMember?: boolean;
  onViewDetails: (event: ContentTranslations) => void;
};

const categoryColors: Record<EventCategory, string> = {
  Social: "bg-purple-100 text-purple-700 border-purple-200",
  Career: "bg-blue-100 text-blue-700 border-blue-200",
  Academic: "bg-green-100 text-green-700 border-green-200",
  Sports: "bg-orange-100 text-orange-700 border-orange-200",
  Culture: "bg-pink-100 text-pink-700 border-pink-200",
};

type EventBadgesProps = {
  category: EventCategory;
  isCollection?: boolean;
  memberOnly?: boolean;
  hasMemberDiscount: boolean;
  hasTicketUrl: boolean;
};

function EventBadges({
  category,
  isCollection,
  memberOnly,
  hasMemberDiscount,
  hasTicketUrl,
}: EventBadgesProps) {
  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2">
      <div className="flex gap-2">
        <Badge
          className={`${categoryColors[category] || categoryColors.Social}`}
        >
          {category}
        </Badge>
        {isCollection && (
          <Badge className="flex items-center gap-1 border-0 bg-[#3DA9E0] text-white">
            <Layers className="h-3 w-3" />
            Collection
          </Badge>
        )}
      </div>
      {memberOnly && (
        <Badge className="flex w-fit items-center gap-1 border-0 bg-orange-500 text-white">
          <Users className="h-3 w-3" />
          Members Only
        </Badge>
      )}
      {!memberOnly && hasMemberDiscount && (
        <Badge className="flex w-fit items-center gap-1 border-0 bg-green-500 text-white">
          <Tag className="h-3 w-3" />
          Member Discount
        </Badge>
      )}
      {hasTicketUrl && (
        <Badge className="flex w-fit items-center gap-1 border-0 bg-purple-500 text-white">
          <ExternalLink className="h-3 w-3" />
          Tickster
        </Badge>
      )}
    </div>
  );
}

type PriceDisplayProps = {
  price: string;
  memberPrice: string | null;
  isMember: boolean;
};

function PriceDisplay({ price, memberPrice, isMember }: PriceDisplayProps) {
  if (memberPrice && !isMember) {
    return (
      <div>
        <div className="font-medium text-gray-900">{price}</div>
        <div className="mt-1 text-[#3DA9E0] text-sm">
          Members: {memberPrice}
        </div>
      </div>
    );
  }

  if (memberPrice && isMember) {
    return (
      <div>
        <div className="text-gray-400 text-sm line-through">{price}</div>
        <div className="font-medium text-[#3DA9E0]">
          {memberPrice} <span className="text-sm">(Member Price)</span>
        </div>
      </div>
    );
  }

  return <div className="font-medium text-gray-900">{price}</div>;
}

export function EventCard({
  event,
  index,
  isMember = false,
  onViewDetails,
}: EventCardProps) {
  const eventData = event.event_ref;

  // Parse metadata if available
  const metadata = parseEventMetadata(eventData?.metadata);
  const category = getEventCategory(metadata);

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

  // Format price
  const price = formatEventPrice(eventData?.price);
  const memberPrice = metadata.member_price
    ? formatEventPrice(metadata.member_price)
    : null;

  // Get attendees from metadata
  const attendees = metadata.attendees || 0;

  // Get image URL
  const imageUrl =
    eventData?.image ||
    "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="group flex h-full flex-col overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl">
        {/* Image */}
        <div className="relative h-56 overflow-hidden">
          <ImageWithFallback
            alt={event.title}
            className="object-cover transition-transform duration-500 group-hover:scale-110"
            fill
            src={imageUrl}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />

          <EventBadges
            category={category}
            hasMemberDiscount={Boolean(memberPrice)}
            hasTicketUrl={Boolean(eventData?.ticket_url)}
            isCollection={eventData?.is_collection}
            memberOnly={eventData?.member_only}
          />

          <div className="absolute right-4 bottom-4 rounded-full bg-white/90 px-3 py-1 backdrop-blur-sm">
            <span className="font-medium text-[#001731]">{price}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex grow flex-col p-6">
          <h3 className="mb-3 font-semibold text-gray-900 text-xl">
            {event.title}
          </h3>
          <p className="mb-4 line-clamp-2 grow text-gray-600 text-sm">
            {event.description}
          </p>

          {eventData?.is_collection && (
            <div className="mb-4 rounded-lg border border-[#3DA9E0]/20 bg-[#3DA9E0]/10 p-3">
              <p className="mb-1 text-[#001731] text-sm">
                <Layers className="mr-1 inline h-4 w-4" />
                Multi-day event collection
              </p>
              {eventData.collection_pricing === "bundle" && (
                <p className="mt-1 text-[#3DA9E0] text-sm">
                  • Bundle pricing: One ticket for all events
                </p>
              )}
              {eventData.collection_pricing === "individual" && (
                <p className="mt-1 text-[#3DA9E0] text-sm">
                  • Individual pricing: Register for each event separately
                </p>
              )}
            </div>
          )}

          <div className="mb-6 space-y-2">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Calendar className="h-4 w-4 text-[#3DA9E0]" />
              <span>{startDate}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <Clock className="h-4 w-4 text-[#3DA9E0]" />
              <span>{timeRange}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <MapPin className="h-4 w-4 text-[#3DA9E0]" />
              <span>{eventData?.location || "Location TBA"}</span>
            </div>
            {attendees > 0 && (
              <div className="flex items-center gap-2 text-gray-600 text-sm">
                <Users className="h-4 w-4 text-[#3DA9E0]" />
                <span>{attendees} attending</span>
              </div>
            )}

            {/* Price */}
            <div className="mt-3 border-gray-200 border-t pt-3">
              <PriceDisplay
                isMember={isMember}
                memberPrice={memberPrice}
                price={price}
              />
            </div>
          </div>

          <Button
            className="w-full border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
            onClick={() => onViewDetails(event)}
          >
            {eventData?.is_collection ? "View Collection" : "View Details"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
