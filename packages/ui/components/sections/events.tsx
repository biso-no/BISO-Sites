"use client";
import { ArrowRight, Calendar, Clock, MapPin, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { ImageWithFallback } from "../image";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export type EventItem = {
  $id: string;
  content_id: string | number;
  title: string;
  image?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  category?: string;
  attendees?: number;
};

export type EventsProps = {
  events: EventItem[];
  labels: {
    empty: string;
    emptyDescription: string;
    upcomingEvents: string;
    dontMissOut: string;
    amazingExperiences: string;
    description: string;
    registerNow: string;
    viewAllEvents: string;
  };
};

function formatEventTime(start: Date | null, end: Date | null) {
  const options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };

  if (start && end) {
    return `${start.toLocaleTimeString("en-US", options)} - ${end.toLocaleTimeString("en-US", options)}`;
  }

  if (start) {
    return start.toLocaleTimeString("en-US", options);
  }

  return "TBA";
}

type EventCardProps = {
  event: EventItem;
  isFeatured: boolean;
  labels: EventsProps["labels"];
  categoryColors: Record<string, string>;
  index: number;
};

function EventCard({
  event,
  isFeatured,
  labels,
  categoryColors,
  index,
}: EventCardProps) {
  const startDate = event.start_date ? new Date(event.start_date) : null;
  const endDate = event.end_date ? new Date(event.end_date) : null;

  const dateString = startDate
    ? startDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBA";

  const timeString = formatEventTime(startDate, endDate);

  return (
    <motion.div
      className={isFeatured ? "md:col-span-2" : ""}
      initial={{ opacity: 0, y: 20 }}
      transition={{ delay: index * 0.1 }}
      viewport={{ once: true }}
      whileInView={{ opacity: 1, y: 0 }}
    >
      <Card className="group overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-2xl">
        <div className={`grid ${isFeatured ? "md:grid-cols-2" : ""} gap-0`}>
          {/* Image */}
          <div
            className={`relative overflow-hidden ${isFeatured ? "h-96 md:h-auto" : "h-64"}`}
          >
            <ImageWithFallback
              alt={event.title}
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              fill
              src={
                event.image ||
                "https://images.unsplash.com/photo-1758270705657-f28eec1a5694?w=1080"
              }
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            {event.category && (
              <Badge
                className={`absolute top-4 left-4 ${categoryColors[event.category] || "bg-gray-100 text-gray-900"}`}
              >
                {event.category}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col justify-between p-8">
            <div>
              <h3 className="mb-4 text-gray-900">{event.title}</h3>

              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{dateString}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <Clock className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{timeString}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-600">
                  <MapPin className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{event.location || "Location TBA"}</span>
                </div>
                {event.attendees !== undefined && (
                  <div className="flex items-center gap-3 text-gray-600">
                    <Users className="h-5 w-5 text-[#3DA9E0]" />
                    <span>{event.attendees} attending</span>
                  </div>
                )}
              </div>
            </div>

            <Link href={`/events/${event.content_id}`}>
              <Button className="group w-full border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
                {labels.registerNow}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function Events({ events, labels }: EventsProps) {
  const categoryColors: Record<string, string> = {
    Social: "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
    Career: "bg-[#001731]/10 text-[#001731] border-[#001731]/20",
    Academic: "bg-cyan-100 text-[#001731] border-cyan-200",
  };

  if (!events || events.length === 0) {
    return (
      <section className="bg-white py-24" id="events">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-6 text-gray-900">{labels.empty}</h2>
            <p className="text-gray-600">{labels.emptyDescription}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-24" id="events">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 inline-block rounded-full bg-[#3DA9E0]/10 px-4 py-2 text-[#001731]">
            {labels.upcomingEvents}
          </div>
          <h2 className="mb-6 text-gray-900">
            {labels.dontMissOut}
            <br />
            <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              {labels.amazingExperiences}
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-gray-600">
            {labels.description}
          </p>
        </motion.div>

        {/* Events Grid */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          {events.map((event, index) => (
            <EventCard
              categoryColors={categoryColors}
              event={event}
              index={index}
              isFeatured={index === 0}
              key={event.$id}
              labels={labels}
            />
          ))}
        </div>

        {/* View All Button */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <Link href="/events">
            <Button
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
              size="lg"
              variant="outline"
            >
              {labels.viewAllEvents}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
