"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Events, type EventsProps } from "../sections/events";

function FilteredEventsContent({ events = [], labels }: EventsProps) {
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const query = searchParams.get("q")?.toLowerCase();

  const filteredEvents = events.filter((event) => {
    const matchesCategory =
      !category || category === "All" || event.category === category;
    const matchesSearch =
      !query ||
      event.title.toLowerCase().includes(query) ||
      event.location?.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  return <Events events={filteredEvents} labels={labels} />;
}

export function FilteredEvents(props: EventsProps) {
  return (
    <Suspense fallback={<Events {...props} />}>
      <FilteredEventsContent {...props} />
    </Suspense>
  );
}
