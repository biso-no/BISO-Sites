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

interface EventsClientProps {
  events: ContentTranslations[];
}

export function EventsClient({ events }: EventsClientProps) {
  const t = useTranslations("home.events");
  const categoryColors: Record<string, string> = {
    Social: "bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20",
    Career: "bg-[#001731]/10 text-[#001731] border-[#001731]/20",
    Academic: "bg-cyan-100 text-[#001731] border-cyan-200",
  };

  if (!events || events.length === 0) {
    return (
      <section id="events" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="mb-6 text-gray-900">{t("empty")}</h2>
            <p className="text-gray-600">{t("emptyDescription")}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="events" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-block px-4 py-2 rounded-full bg-[#3DA9E0]/10 text-[#001731] mb-6">
            {t("upcomingEvents")}
          </div>
          <h2 className="mb-6 text-gray-900">
            {t("dontMissOut")}
            <br />
            <span className="bg-linear-to-r from-[#3DA9E0] to-[#001731] bg-clip-text text-transparent">
              {t("amazingExperiences")}
            </span>
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{t("description")}</p>
        </motion.div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {events.map((event, index) => {
            const isFeatured = index === 0;
            const eventRef = event.event_ref;
            const startDate = eventRef?.start_date
              ? new Date(eventRef.start_date)
              : null;
            const endDate = eventRef?.end_date
              ? new Date(eventRef.end_date)
              : null;

            // Format date and time
            const dateString = startDate
              ? startDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "TBA";

            const timeString =
              startDate && endDate
                ? `${startDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} - ${endDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                : startDate
                  ? startDate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "TBA";

            return (
              <motion.div
                key={event.$id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={isFeatured ? "md:col-span-2" : ""}
              >
                <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group">
                  <div
                    className={`grid ${isFeatured ? "md:grid-cols-2" : ""} gap-0`}
                  >
                    {/* Image */}
                    <div
                      className={`relative overflow-hidden ${isFeatured ? "h-96 md:h-auto" : "h-64"}`}
                    >
                      <ImageWithFallback
                        src={
                          eventRef?.image ||
                          "https://images.unsplash.com/photo-1758270705657-f28eec1a5694?w=1080"
                        }
                        alt={event.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
                      {eventRef?.metadata &&
                        typeof eventRef.metadata === "object" &&
                        "category" in eventRef.metadata && (
                          <Badge
                            className={`absolute top-4 left-4 ${categoryColors[eventRef.metadata.category as string] || "bg-gray-100 text-gray-900"}`}
                          >
                            {eventRef.metadata.category as string}
                          </Badge>
                        )}
                    </div>

                    {/* Content */}
                    <div className="p-8 flex flex-col justify-between">
                      <div>
                        <h3 className="mb-4 text-gray-900">{event.title}</h3>

                        <div className="space-y-3 mb-6">
                          <div className="flex items-center gap-3 text-gray-600">
                            <Calendar className="w-5 h-5 text-[#3DA9E0]" />
                            <span>{dateString}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <Clock className="w-5 h-5 text-[#3DA9E0]" />
                            <span>{timeString}</span>
                          </div>
                          <div className="flex items-center gap-3 text-gray-600">
                            <MapPin className="w-5 h-5 text-[#3DA9E0]" />
                            <span>{eventRef?.location || "Location TBA"}</span>
                          </div>
                          {eventRef?.metadata &&
                            typeof eventRef.metadata === "object" &&
                            "attendees" in eventRef.metadata && (
                              <div className="flex items-center gap-3 text-gray-600">
                                <Users className="w-5 h-5 text-[#3DA9E0]" />
                                <span>
                                  {eventRef.metadata.attendees} attending
                                </span>
                              </div>
                            )}
                        </div>
                      </div>

                      <Link href={`/events/${event.content_id}`}>
                        <Button className="w-full bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0 group">
                          {t("registerNow")}
                          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/events">
            <Button
              variant="outline"
              size="lg"
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
            >
              {t("viewAllEvents")}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
