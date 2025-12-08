"use client";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { ArrowRight, Calendar, Clock, MapPin, Users } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const CATEGORY_COLORS: Record<string, string> = {
  Social: "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
  Career: "bg-[#001731]/10 text-[#001731] border-[#001731]/20",
  Academic: "bg-cyan-100 text-[#001731] border-cyan-200",
};

function formatDateString(date: Date | null): string {
  if (!date) {
    return "TBA";
  }
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeString(
  startDate: Date | null,
  endDate: Date | null
): string {
  if (!startDate) {
    return "TBA";
  }
  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!endDate) {
    return startTime;
  }
  const endTime = endDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${startTime} - ${endTime}`;
}

function getCategory(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "category" in metadata) {
    return metadata.category as string;
  }
  return null;
}

function getAttendees(metadata: unknown): string | null {
  if (metadata && typeof metadata === "object" && "attendees" in metadata) {
    return String(metadata.attendees);
  }
  return null;
}

type EventCardProps = {
  event: ContentTranslations;
  index: number;
  registerLabel: string;
};

function EventCard({ event, index, registerLabel }: EventCardProps) {
  const isFeatured = index === 0;
  const eventRef = event.event_ref;
  const startDate = eventRef?.start_date ? new Date(eventRef.start_date) : null;
  const endDate = eventRef?.end_date ? new Date(eventRef.end_date) : null;
  const dateString = formatDateString(startDate);
  const timeString = formatTimeString(startDate, endDate);
  const category = getCategory(eventRef?.metadata);
  const attendees = getAttendees(eventRef?.metadata);
  const imageUrl =
    eventRef?.image ||
    "https://images.unsplash.com/photo-1758270705657-f28eec1a5694?w=1080";

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
              src={imageUrl}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            {category && (
              <Badge
                className={`absolute top-4 left-4 ${CATEGORY_COLORS[category] || "bg-muted text-foreground"}`}
              >
                {category}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col justify-between p-8">
            <div>
              <h3 className="mb-4 text-foreground">{event.title}</h3>

              <div className="mb-6 space-y-3">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Calendar className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{dateString}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Clock className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{timeString}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <MapPin className="h-5 w-5 text-[#3DA9E0]" />
                  <span>{eventRef?.location || "Location TBA"}</span>
                </div>
                {attendees && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Users className="h-5 w-5 text-[#3DA9E0]" />
                    <span>{attendees} attending</span>
                  </div>
                )}
              </div>
            </div>

            <Link href={`/events/${event.content_id}`}>
              <Button className="group w-full border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white hover:from-[#3DA9E0]/90 hover:to-[#001731]/90">
                {registerLabel}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

type EventsClientProps = {
  events: ContentTranslations[];
};

export function EventsClient({ events }: EventsClientProps) {
  const t = useTranslations("home.events");

  if (!events || events.length === 0) {
    return (
      <section className="bg-background py-24" id="events">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-6 text-foreground">{t("empty")}</h2>
            <p className="text-muted-foreground">{t("emptyDescription")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-24" id="events">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 inline-block rounded-full bg-[#3DA9E0]/10 px-4 py-2 text-[#001731]">
            {t("upcomingEvents")}
          </div>
          <h2 className="mb-6 text-foreground">
            {t("dontMissOut")}
            <br />
            <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              {t("amazingExperiences")}
            </span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">{t("description")}</p>
        </motion.div>

        {/* Events Grid */}
        <div className="mb-12 grid gap-8 md:grid-cols-2">
          {events.map((event, index) => (
            <EventCard
              event={event}
              index={index}
              key={event.$id}
              registerLabel={t("registerNow")}
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
              {t("viewAllEvents")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
