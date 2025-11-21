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

interface EventDetailsClientProps {
  event: ContentTranslations;
  collectionEvents?: ContentTranslations[];
  isMember?: boolean;
}

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

  const startTime = eventData?.start_date ? format(new Date(eventData.start_date), "HH:mm") : "";

  const endTime = eventData?.end_date ? format(new Date(eventData.end_date), "HH:mm") : "";

  const timeRange = startTime && endTime ? `${startTime} - ${endTime}` : startTime || "TBA";

  // Format price
  const price = formatEventPrice(eventData?.price);
  const memberPrice = metadata.member_price ? formatEventPrice(metadata.member_price) : null;

  // Get metadata
  const attendees = metadata.attendees || 0;
  const highlights = metadata.highlights || [];
  const agenda = metadata.agenda || [];

  // Get image URL
  const imageUrl =
    eventData?.image || "https://images.unsplash.com/photo-1758270705657-f28eec1a5694";

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
        <ImageWithFallback src={imageUrl} alt={event.title} fill className="object-cover" />
        <div className="absolute inset-0 bg-linear-to-br from-[#001731]/95 via-[#3DA9E0]/70 to-[#001731]/90" />

        <div className="absolute inset-0">
          <div className="max-w-5xl mx-auto px-4 h-full flex items-center">
            <motion.button
              onClick={() => router.push("/events")}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-8 left-8 flex items-center gap-2 text-white hover:text-[#3DA9E0] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Events
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12"
            >
              <Badge className={`mb-4 ${categoryColors[category]}`}>{category}</Badge>
              <h1 className="text-white mb-4 text-4xl md:text-5xl font-bold">{event.title}</h1>

              <div className="flex flex-wrap items-center gap-4 mt-6">
                <div className="flex items-center gap-2 text-white/90">
                  <Calendar className="w-5 h-5 text-[#3DA9E0]" />
                  <span>{startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <Clock className="w-5 h-5 text-[#3DA9E0]" />
                  <span>{timeRange}</span>
                </div>
                <div className="flex items-center gap-2 text-white/90">
                  <MapPin className="w-5 h-5 text-[#3DA9E0]" />
                  <span>{eventData?.location || "Location TBA"}</span>
                </div>
                {attendees > 0 && (
                  <div className="flex items-center gap-2 text-white/90">
                    <Users className="w-5 h-5 text-[#3DA9E0]" />
                    <span>{attendees} attending</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-8 border-0 shadow-lg">
                <h2 className="text-gray-900 mb-4 text-2xl font-bold">About This Event</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {event.description}
                </p>
              </Card>
            </motion.div>

            {/* Highlights */}
            {highlights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card className="p-8 border-0 shadow-lg">
                  <h2 className="text-gray-900 mb-6 text-2xl font-bold">What to Expect</h2>
                  <ul className="space-y-4">
                    {highlights.map((highlight: string, index: number) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#3DA9E0] shrink-0 mt-1" />
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <Card className="p-8 border-0 shadow-lg">
                  <h2 className="text-gray-900 mb-6 text-2xl font-bold">Event Schedule</h2>
                  <div className="space-y-6">
                    {agenda.map((item: { time: string; activity: string }, index: number) => (
                      <div key={index}>
                        <div className="flex gap-4">
                          <div className="shrink-0 w-20 text-[#3DA9E0] font-semibold">
                            {item.time}
                          </div>
                          <div className="flex-1">
                            <p className="text-gray-700">{item.activity}</p>
                          </div>
                        </div>
                        {index < agenda.length - 1 && <Separator className="my-4" />}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Collection Events */}
            {collectionEvents && collectionEvents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="p-8 border-0 shadow-lg bg-linear-to-br from-[#3DA9E0]/5 to-[#001731]/5">
                  <div className="flex items-start justify-between mb-6">
                    <h2 className="text-gray-900 text-2xl font-bold">
                      {eventData?.is_collection
                        ? "Events in This Collection"
                        : "Other Events in This Collection"}
                    </h2>
                    {eventData?.is_collection && eventData.collection_pricing === "bundle" && (
                      <Badge className="bg-green-100 text-green-700 border-green-200">
                        Bundle Pricing
                      </Badge>
                    )}
                    {eventData?.is_collection && eventData.collection_pricing === "individual" && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                        Individual Pricing
                      </Badge>
                    )}
                  </div>

                  {eventData?.is_collection && eventData.collection_pricing === "bundle" && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Bundle Pricing:</strong> Pay {price} once to get access to all{" "}
                        {collectionEvents.length} events in this collection.
                      </p>
                    </div>
                  )}

                  {eventData?.is_collection && eventData.collection_pricing === "individual" && (
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Individual Pricing:</strong> Each event can be registered for
                        separately. Choose the events that interest you most!
                      </p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {collectionEvents
                      .filter((e) => e.$id !== event.$id)
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
                          <Card
                            key={collectionEvent.$id}
                            className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                            onClick={() => router.push(`/events/${collectionEvent.content_id}`)}
                          >
                            <div className="flex items-start gap-4">
                              <div className="relative w-20 h-20 shrink-0">
                                <ImageWithFallback
                                  src={colImage}
                                  alt={collectionEvent.title}
                                  fill
                                  className="object-cover rounded-lg"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h3 className="text-gray-900 font-semibold">
                                    {collectionEvent.title}
                                  </h3>
                                  {eventData?.collection_pricing === "individual" && (
                                    <span className="text-sm text-[#3DA9E0] whitespace-nowrap font-medium">
                                      {colPrice}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{colStartDate}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-blue-50">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="mb-2 text-gray-900 font-semibold">Important Information</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
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
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Price Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-green-50 to-emerald-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">
                      {eventData?.is_collection && eventData.collection_pricing === "bundle"
                        ? "Bundle Price"
                        : eventData?.is_collection && eventData.collection_pricing === "individual"
                          ? "Pricing"
                          : "Price"}
                    </div>
                    <div className="text-gray-900 font-bold text-xl">{displayPrice}</div>
                    {showMemberDiscount && (
                      <div className="text-xs text-green-600">Members: {memberPrice}</div>
                    )}
                  </div>
                </div>
                {price === "Free" ? (
                  <p className="text-sm text-gray-600">This event is free for all students!</p>
                ) : eventData?.is_collection && eventData.collection_pricing === "bundle" ? (
                  <p className="text-sm text-gray-600">
                    One payment gives you access to all {collectionEvents?.length || 0} events in
                    this collection!
                  </p>
                ) : eventData?.is_collection && eventData.collection_pricing === "individual" ? (
                  <p className="text-sm text-gray-600">
                    Register for individual events separately based on your interests.
                  </p>
                ) : eventData?.collection_id ? (
                  <p className="text-sm text-gray-600">
                    This event is part of a collection. Check collection details for bundle pricing.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">Secure your spot with online payment.</p>
                )}
              </Card>
            </motion.div>

            {/* Register/Tickster Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-linear-to-br from-[#001731] to-[#3DA9E0]">
                <h3 className="mb-4 text-white text-xl font-bold">
                  {eventData?.ticket_url ? "Get Your Ticket" : "Register Now"}
                </h3>
                <p className="text-white/90 text-sm mb-6">
                  {eventData?.ticket_url
                    ? "Click below to purchase your ticket on Tickster and secure your spot!"
                    : "Spaces are limited! Register now to guarantee your attendance."}
                </p>
                {eventData?.ticket_url ? (
                  <Button
                    className="w-full bg-white text-[#001731] hover:bg-white/90 mb-3"
                    onClick={() => window.open(eventData.ticket_url!, "_blank")}
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    Buy on Tickster
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button className="w-full bg-white text-[#001731] hover:bg-white/90 mb-3">
                    <Ticket className="w-4 h-4 mr-2" />
                    Register Now
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-white text-white hover:bg-white/10"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Event
                </Button>
              </Card>
            </motion.div>

            {/* Event Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="p-6 border-0 shadow-lg">
                <h3 className="mb-4 text-gray-900 font-bold">Event Details</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Date</div>
                    <div className="text-gray-900">{startDate}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Time</div>
                    <div className="text-gray-900">{timeRange}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Location</div>
                    <div className="text-gray-900">{eventData?.location || "Location TBA"}</div>
                  </div>
                  <Separator />
                  <div>
                    <div className="text-sm text-gray-500 mb-1">Category</div>
                    <div className="text-gray-900">{category}</div>
                  </div>
                  {attendees > 0 && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Expected Attendance</div>
                        <div className="text-gray-900">{attendees} students</div>
                      </div>
                    </>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Contact Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="p-6 border-0 shadow-lg bg-blue-50">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="mb-2 text-gray-900 font-semibold">Questions?</h4>
                    <p className="text-sm text-gray-600">
                      Contact our events team at{" "}
                      <a href="mailto:events@biso.no" className="text-[#3DA9E0] hover:underline">
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
