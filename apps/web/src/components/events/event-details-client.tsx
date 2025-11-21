"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Separator } from "@repo/ui/components/ui/separator";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Info,
  Mail,
  MapPin,
  Share2,
  Ticket,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  type EventCategory,
  formatEventPrice,
  getEventCategory,
  parseEventMetadata,
} from "@/lib/types/event";

type EventDetailsClientProps = {
  event: ContentTranslations;
  collectionEvents?: ContentTranslations[];
  isMember?: boolean;
};

const categoryColors: Record<EventCategory, string> = {
  Social: "bg-purple-100 text-purple-700 border-purple-200",
  Career: "bg-blue-100 text-blue-700 border-blue-200",
  Academic: "bg-green-100 text-green-700 border-green-200",
  Sports: "bg-orange-100 text-orange-700 border-orange-200",
  Culture: "bg-pink-100 text-pink-700 border-pink-200",
};

export function EventDetailsClient({
  event,
  collectionEvents,
  isMember = false,
}: EventDetailsClientProps) {
  const router = useRouter();
  const eventData = event.event_ref;

  // Parse metadata
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

  // Get metadata
  const attendees = metadata.attendees || 0;
  const highlights = metadata.highlights || [];
  const agenda = metadata.agenda || [];

  // Get image URL
  const imageUrl =
    eventData?.image ||
    "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

  // Display price logic
  const displayPrice = isMember && memberPrice ? memberPrice : price;
  const showMemberDiscount = !isMember && memberPrice;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: event.description,
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
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="relative h-[50vh] overflow-hidden">
        <ImageWithFallback
          alt={event.title}
          className="object-cover"
          fill
          src={imageUrl}
        />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0">
          <div className="mx-auto flex h-full max-w-5xl items-center px-4">
            <motion.button
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white transition-colors hover:text-[#3DA9E0]"
              initial={{ opacity: 0, x: -20 }}
              onClick={() => router.push("/events")}
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Events
            </motion.button>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
              initial={{ opacity: 0, y: 20 }}
            >
              <Badge className={`mb-4 ${categoryColors[category]}`}>
                {category}
              </Badge>
              <h1 className="mb-4 font-bold text-4xl text-white md:text-5xl">
                {event.title}
              </h1>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Clock className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{timeRange}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <MapPin className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{eventData?.location || "Location TBA"}</span>
                </div>
                {attendees > 0 && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Users className="h-5 w-5 text-[#3DA9E0]" />
                    <span>{attendees} attending</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="space-y-8 lg:col-span-2">
            {/* Overview */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 p-8 shadow-lg">
                <h2 className="mb-4 font-bold text-2xl text-gray-900">
                  About This Event
                </h2>
                <p className="whitespace-pre-line text-gray-700 leading-relaxed">
                  {event.description}
                </p>
              </Card>
            </motion.div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="border-0 p-8 shadow-lg">
                  <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    What to Expect
                  </h2>
                  <ul className="space-y-4">
                    {highlights.map((highlight: string, index: number) => (
                      <li className="flex items-start gap-3" key={index}>
                        <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#3DA9E0]" />
                        <span className="text-gray-700">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </motion.div>
            )}

            {/* Agenda */}
            {agenda.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="border-0 p-8 shadow-lg">
                  <h2 className="mb-6 font-bold text-2xl text-gray-900">
                    Event Schedule
                  </h2>
                  <div className="space-y-6">
                    {agenda.map(
                      (
                        item: { time: string; activity: string },
                        index: number
                      ) => (
                        <div key={index}>
                          <div className="flex gap-4">
                            <div className="w-20 shrink-0 font-semibold text-[#3DA9E0]">
                              {item.time}
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-700">{item.activity}</p>
                            </div>
                          </div>
                          {index < agenda.length - 1 && (
                            <Separator className="my-4" />
                          )}
                        </div>
                      )
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Collection Events */}
            {collectionEvents && collectionEvents.length > 0 && (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="border-0 bg-linear-to-br from-[#3DA9E0]/5 to-[#001731]/5 p-8 shadow-lg">
                  <div className="mb-6 flex items-start justify-between">
                    <h2 className="font-bold text-2xl text-gray-900">
                      {eventData?.is_collection
                        ? "Events in This Collection"
                        : "Other Events in This Collection"}
                    </h2>
                    {eventData?.is_collection &&
                      eventData.collection_pricing === "bundle" && (
                        <Badge className="border-green-200 bg-green-100 text-green-700">
                          Bundle Pricing
                        </Badge>
                      )}
                    {eventData?.is_collection &&
                      eventData.collection_pricing === "individual" && (
                        <Badge className="border-blue-200 bg-blue-100 text-blue-700">
                          Individual Pricing
                        </Badge>
                      )}
                  </div>

                  {eventData?.is_collection &&
                    eventData.collection_pricing === "bundle" && (
                      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                        <p className="text-gray-700 text-sm">
                          <strong>Bundle Pricing:</strong> Pay {price} once to
                          get access to all {collectionEvents.length} events in
                          this collection.
                        </p>
                      </div>
                    )}

                  {eventData?.is_collection &&
                    eventData.collection_pricing === "individual" && (
                      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <p className="text-gray-700 text-sm">
                          <strong>Individual Pricing:</strong> Each event can be
                          registered for separately. Choose the events that
                          interest you most!
                        </p>
                      </div>
                    )}

                  <div className="space-y-4">
                    {collectionEvents
                      .filter((e) => e.$id !== event.$id)
                      .map((collectionEvent) => {
                        const colEventData = collectionEvent.event_ref;
                        const colStartDate = colEventData?.start_date
                          ? format(
                              new Date(colEventData.start_date),
                              "MMMM d, yyyy"
                            )
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
                          <Card
                            className="cursor-pointer p-4 transition-shadow hover:shadow-md"
                            key={collectionEvent.$id}
                            onClick={() =>
                              router.push(
                                `/events/${collectionEvent.content_id}`
                              )
                            }
                          >
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
                                  {eventData?.collection_pricing ===
                                    "individual" && (
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
                        );
                      })}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Important Info */}
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-2 font-semibold text-gray-900">
                      Important Information
                    </h4>
                    <ul className="space-y-1 text-gray-600 text-sm">
                      <li>
                        • Please arrive 15 minutes before the event starts
                      </li>
                      <li>• Valid student ID required for entry</li>
                      <li>
                        • Registration confirmation will be sent via email
                      </li>
                      {price !== "Free" && (
                        <li>
                          • Refunds available up to 48 hours before the event
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 bg-linear-to-br from-green-50 to-emerald-50 p-6 shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="text-gray-600 text-sm">
                      {eventData?.is_collection &&
                      eventData.collection_pricing === "bundle"
                        ? "Bundle Price"
                        : eventData?.is_collection &&
                            eventData.collection_pricing === "individual"
                          ? "Pricing"
                          : "Price"}
                    </div>
                    <div className="font-bold text-gray-900 text-xl">
                      {displayPrice}
                    </div>
                    {showMemberDiscount && (
                      <div className="text-green-600 text-xs">
                        Members: {memberPrice}
                      </div>
                    )}
                  </div>
                </div>
                {price === "Free" ? (
                  <p className="text-gray-600 text-sm">
                    This event is free for all students!
                  </p>
                ) : eventData?.is_collection &&
                  eventData.collection_pricing === "bundle" ? (
                  <p className="text-gray-600 text-sm">
                    One payment gives you access to all{" "}
                    {collectionEvents?.length || 0} events in this collection!
                  </p>
                ) : eventData?.is_collection &&
                  eventData.collection_pricing === "individual" ? (
                  <p className="text-gray-600 text-sm">
                    Register for individual events separately based on your
                    interests.
                  </p>
                ) : eventData?.collection_id ? (
                  <p className="text-gray-600 text-sm">
                    This event is part of a collection. Check collection details
                    for bundle pricing.
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm">
                    Secure your spot with online payment.
                  </p>
                )}
              </Card>
            </motion.div>

            {/* Register/Tickster Card */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 bg-linear-to-br from-[#001731] to-[#3DA9E0] p-6 shadow-lg">
                <h3 className="mb-4 font-bold text-white text-xl">
                  {eventData?.ticket_url ? "Get Your Ticket" : "Register Now"}
                </h3>
                <p className="mb-6 text-sm text-white/90">
                  {eventData?.ticket_url
                    ? "Click below to purchase your ticket on Tickster and secure your spot!"
                    : "Spaces are limited! Register now to guarantee your attendance."}
                </p>
                {eventData?.ticket_url ? (
                  <Button
                    className="mb-3 w-full bg-white text-[#001731] hover:bg-white/90"
                    onClick={() => window.open(eventData.ticket_url!, "_blank")}
                  >
                    <Ticket className="mr-2 h-4 w-4" />
                    Buy on Tickster
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button className="mb-3 w-full bg-white text-[#001731] hover:bg-white/90">
                    <Ticket className="mr-2 h-4 w-4" />
                    Register Now
                  </Button>
                )}
                <Button
                  className="w-full border-white text-white hover:bg-white/10"
                  onClick={handleShare}
                  variant="outline"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Event
                </Button>
              </Card>
            </motion.div>

            {/* Event Details */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-0 p-6 shadow-lg">
                <h3 className="mb-4 font-bold text-gray-900">Event Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Date</div>
                    <div className="text-gray-900">{startDate}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Time</div>
                    <div className="text-gray-900">{timeRange}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Location</div>
                    <div className="text-gray-900">
                      {eventData?.location || "Location TBA"}
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <div className="mb-1 text-gray-500 text-sm">Category</div>
                    <div className="text-gray-900">{category}</div>
                  </div>
                  {attendees > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="mb-1 text-gray-500 text-sm">
                          Expected Attendance
                        </div>
                        <div className="text-gray-900">
                          {attendees} students
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Contact Card */}
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: 20 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="border-0 bg-blue-50 p-6 shadow-lg">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                  <div>
                    <h4 className="mb-2 font-semibold text-gray-900">
                      Questions?
                    </h4>
                    <p className="text-gray-600 text-sm">
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
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
