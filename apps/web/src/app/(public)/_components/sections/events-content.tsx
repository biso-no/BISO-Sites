"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { useCampus } from "@/components/context/campus";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardTitle } from "@repo/ui/components/ui/card";
import { ScrollArea, ScrollBar } from "@repo/ui/components/ui/scroll-area";

import type { EventWithTranslations } from "@/lib/types/event";

interface EventsContentProps {
  events: EventWithTranslations[];
}

export function EventsContent({ events }: EventsContentProps) {
  const { campuses, activeCampusId } = useCampus();
  const t = useTranslations("home");
  const commonT = useTranslations("common");

  const campusLookup = useMemo(() => {
    return campuses.reduce<Record<string, string>>((acc, campus) => {
      acc[campus.$id] = campus.name;
      return acc;
    }, {});
  }, [campuses]);

  const filteredEvents = useMemo(() => {
    if (!activeCampusId) return events;
    return events.filter((event) => event.campus_id === activeCampusId);
  }, [events, activeCampusId]);

  const spotlightEvents = useMemo(() => filteredEvents.slice(0, 6), [filteredEvents]);

  if (filteredEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-primary/20 bg-white/60 p-10 text-center text-muted-foreground">
        {t("events.empty")}
      </div>
    );
  }

  return (
    <ScrollArea>
      <div className="flex gap-4 pb-4">
        {spotlightEvents.map((event) => (
          <Card key={event.$id} className="min-w-[260px] max-w-sm flex-1 border border-primary/10 bg-white/90 shadow-md transition hover:-translate-y-1 hover:shadow-card-hover">
            <CardContent className="space-y-3 p-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{event.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBD'}</span>
                <span className="rounded-full bg-secondary-10 px-2 py-1 text-secondary-100">
                  {campusLookup[event.campus_id] ?? commonT("labels.organisation")}
                </span>
              </div>
              <CardTitle className="text-lg text-primary-100">
                <Link href={`/events/${event.$id}`} className="hover:underline">
                  {event.title}
                </Link>
              </CardTitle>
              <p className="line-clamp-3 text-sm text-muted-foreground">{event.description}</p>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/events/${event.$id}`}>{commonT("buttons.viewDetails")}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <ScrollBar orientation="horizontal" className="h-2" />
    </ScrollArea>
  );
}
