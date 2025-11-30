import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { Locale } from "@repo/i18n/config";
import { ImageWithFallback } from "@repo/ui/components/image";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";
import { Calendar, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";

type UpcomingEventsProps = {
  events: ContentTranslations[];
  locale: Locale;
};

export function UpcomingEvents({ events, locale }: UpcomingEventsProps) {
  if (!events || events.length === 0) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(locale === "en" ? "en-US" : "nb-NO", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <section>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="mb-2 text-gray-900">
            {locale === "en" ? "Upcoming Events" : "Kommende arrangementer"}
          </h2>
          <p className="text-gray-600">
            {locale === "en"
              ? "Join us at these exciting events"
              : "Bli med på disse spennende arrangementene"}
          </p>
        </div>
        <Button
          asChild
          className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
          variant="outline"
        >
          <Link href="/events">
            {locale === "en" ? "View All Events" : "Se alle arrangementer"}
            <ChevronRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {events.slice(0, 3).map((event, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            initial={{ opacity: 0, y: 20 }}
            key={event.$id}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/events/${event.content_id}`}>
              <Card className="group cursor-pointer overflow-hidden border-0 shadow-lg transition-all hover:shadow-xl">
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    fill
                    src={
                      event.event_ref?.image ||
                      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1080"
                    }
                  />
                  {event.event_ref?.member_only && (
                    <Badge className="absolute top-4 right-4 border-0 bg-[#3DA9E0] text-white">
                      {locale === "en" ? "Members Only" : "Kun medlemmer"}
                    </Badge>
                  )}
                </div>
                <div className="p-6">
                  {event.event_ref?.start_date && (
                    <div className="mb-3 flex items-center gap-2 text-gray-600 text-sm">
                      <Calendar className="h-4 w-4 text-[#3DA9E0]" />
                      {formatDate(event.event_ref.start_date)}
                    </div>
                  )}
                  <h3 className="mb-2 text-gray-900">{event.title}</h3>
                  {event.description && (
                    <p className="line-clamp-2 text-gray-600 text-sm">
                      {event.description.replace(/<[^>]+>/g, "")}
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
