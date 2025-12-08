"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { format } from "date-fns";
import {
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Tag,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type EventCategory,
  formatEventPrice,
  getEventCategory,
  parseEventMetadata,
} from "@/lib/types/event";

type EventDetailModalProps = {
  event: ContentTranslations;
  isMember?: boolean;
  onClose: () => void;
};

const categoryColors: Record<EventCategory, string> = {
  Social: "bg-purple-100 text-purple-700 border-purple-200",
  Career: "bg-blue-100 text-blue-700 border-blue-200",
  Academic: "bg-green-100 text-green-700 border-green-200",
  Sports: "bg-orange-100 text-orange-700 border-orange-200",
  Culture: "bg-pink-100 text-pink-700 border-pink-200",
};

function PriceDisplay({
  price,
  memberPrice,
  isMember,
}: {
  price: string;
  memberPrice: string | null;
  isMember: boolean;
}) {
  if (memberPrice && isMember) {
    return (
      <div className="text-right">
        <div className="text-sm text-white/60 line-through">{price}</div>
        <div className="font-bold text-2xl text-white">{memberPrice}</div>
        <div className="text-white/80 text-xs">Member Price</div>
      </div>
    );
  }
  return <div className="font-bold text-2xl text-white">{price}</div>;
}

function ActionButtons({
  ticketUrl,
  onClose,
}: {
  ticketUrl: string | null | undefined;
  onClose: () => void;
}) {
  return (
    <div className="flex gap-4">
      {ticketUrl ? (
        <Button
          className="flex-1 border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90"
          onClick={() => window.open(ticketUrl, "_blank")}
        >
          Get Tickets on Tickster
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      ) : (
        <Button className="flex-1 border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
          Register Now
        </Button>
      )}
      <Button
        className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
        onClick={onClose}
        variant="outline"
      >
        Close
      </Button>
    </div>
  );
}

export function EventDetailModal({
  event,
  isMember = false,
  onClose,
}: EventDetailModalProps) {
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

  const timeRange = (() => {
    if (startTime && endTime) {
      return `${startTime} - ${endTime}`;
    }
    return startTime || "TBA";
  })();

  // Format price
  const price = formatEventPrice(eventData?.price);
  const memberPrice = metadata.member_price
    ? formatEventPrice(metadata.member_price)
    : null;

  // Get attendees and other metadata
  const attendees = metadata.attendees || 0;
  const highlights = metadata.highlights || [];
  const agenda = metadata.agenda || [];

  // Get image URL
  const imageUrl =
    eventData?.image ||
    "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          animate={{ scale: 1, opacity: 1 }}
          className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-background shadow-2xl"
          exit={{ scale: 0.95, opacity: 0 }}
          initial={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Image */}
          <div className="relative h-80 overflow-hidden rounded-t-2xl">
            <ImageWithFallback
              alt={event.title}
              className="object-cover"
              fill
              src={imageUrl}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />

            {/* Close Button */}
            <button
              className="absolute top-4 right-4 rounded-full bg-background/90 p-2 transition-colors hover:bg-background"
              onClick={onClose}
              type="button"
            >
              <X className="h-6 w-6 text-foreground" />
            </button>

            {/* Category Badge */}
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge
                className={`${categoryColors[category] || categoryColors.Social}`}
              >
                {category}
              </Badge>
              {memberPrice && !isMember && (
                <Badge className="flex items-center gap-1 border-0 bg-green-500 text-white">
                  <Tag className="h-3 w-3" />
                  Member Discount
                </Badge>
              )}
            </div>

            {/* Title and Price */}
            <div className="absolute right-0 bottom-0 left-0 p-8">
              <div className="flex items-end justify-between">
                <div className="flex-1">
                  <h2 className="mb-2 font-bold text-4xl text-white">
                    {event.title}
                  </h2>
                </div>
                <div className="ml-4">
                  <PriceDisplay
                    isMember={isMember}
                    memberPrice={memberPrice}
                    price={price}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Event Details */}
            <div className="mb-8 grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-1 h-5 w-5 text-[#3DA9E0]" />
                  <div>
                    <div className="font-medium text-foreground">Date</div>
                    <div className="text-muted-foreground">{startDate}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="mt-1 h-5 w-5 text-[#3DA9E0]" />
                  <div>
                    <div className="font-medium text-foreground">Time</div>
                    <div className="text-muted-foreground">{timeRange}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-5 w-5 text-[#3DA9E0]" />
                  <div>
                    <div className="font-medium text-foreground">Location</div>
                    <div className="text-muted-foreground">
                      {eventData?.location || "Location TBA"}
                    </div>
                  </div>
                </div>

                {attendees > 0 && (
                  <div className="flex items-start gap-3">
                    <Users className="mt-1 h-5 w-5 text-[#3DA9E0]" />
                    <div>
                      <div className="font-medium text-foreground">Attendees</div>
                      <div className="text-muted-foreground">{attendees} attending</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Member Price Info */}
            {memberPrice && !isMember && (
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <Tag className="h-4 w-4" />
                  <span className="font-medium">
                    Members get this event for {memberPrice}! Join BISO to save.
                  </span>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="mb-8">
              <h3 className="mb-4 font-bold text-2xl text-foreground">
                About This Event
              </h3>
              <div className="prose prose-gray max-w-none">
                <p className="whitespace-pre-line text-muted-foreground">
                  {event.description}
                </p>
              </div>
            </div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-4 font-bold text-2xl text-foreground">
                  Event Highlights
                </h3>
                <ul className="grid gap-3 md:grid-cols-2">
                  {highlights.map((highlight: string, idx: number) => (
                    <li className="flex items-start gap-2" key={idx}>
                      <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3DA9E0]" />
                      <span className="text-muted-foreground">{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Agenda */}
            {agenda.length > 0 && (
              <div className="mb-8">
                <h3 className="mb-4 font-bold text-2xl text-foreground">
                  Agenda
                </h3>
                <div className="space-y-4">
                  {agenda.map(
                    (item: { time: string; activity: string }, idx: number) => (
                      <div className="flex gap-4" key={idx}>
                        <div className="w-20 shrink-0">
                          <Badge
                            className="border-[#3DA9E0] text-[#3DA9E0]"
                            variant="outline"
                          >
                            {item.time}
                          </Badge>
                        </div>
                        <div className="text-muted-foreground">{item.activity}</div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <ActionButtons 
            onClose={onClose} 
            ticketUrl={eventData?.ticket_url}
          />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
