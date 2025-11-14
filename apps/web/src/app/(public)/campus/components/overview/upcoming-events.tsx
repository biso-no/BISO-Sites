import { motion } from "motion/react";
import { Calendar, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { ImageWithFallback } from "@repo/ui/components/image";
import type { ContentTranslations } from "@repo/api/types/appwrite";
import type { Locale } from "@/i18n/config";

interface UpcomingEventsProps {
  events: ContentTranslations[];
  locale: Locale;
}

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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-gray-900 mb-2">
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
          variant="outline"
          className="border-[#3DA9E0]/20 text-[#3DA9E0] hover:bg-[#3DA9E0]/10"
        >
          <Link href="/events">
            {locale === "en" ? "View All Events" : "Se alle arrangementer"}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {events.slice(0, 3).map((event, index) => (
          <motion.div
            key={event.$id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link href={`/events/${event.content_id}`}>
              <Card className="overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
                <div className="relative h-48 overflow-hidden">
                  <ImageWithFallback
                    src={
                      event.event_ref?.image ||
                      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=1080"
                    }
                    alt={event.title}
                    fill
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {event.event_ref?.member_only && (
                    <Badge className="absolute top-4 right-4 bg-[#3DA9E0] text-white border-0">
                      {locale === "en" ? "Members Only" : "Kun medlemmer"}
                    </Badge>
                  )}
                </div>
                <div className="p-6">
                  {event.event_ref?.start_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                      <Calendar className="w-4 h-4 text-[#3DA9E0]" />
                      {formatDate(event.event_ref.start_date)}
                    </div>
                  )}
                  <h3 className="text-gray-900 mb-2">{event.title}</h3>
                  {event.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">
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

