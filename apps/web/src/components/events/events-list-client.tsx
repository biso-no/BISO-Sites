"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Calendar, Filter, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  eventCategories,
  getEventCategory,
  parseEventMetadata,
} from "@/lib/types/event";
import { EventCard } from "./event-card";
import { EventDetailModal } from "./event-detail-modal";

type EventsListClientProps = {
  events: ContentTranslations[];
  isMember?: boolean;
};

const categories = ["All", ...eventCategories] as const;

export function EventsListClient({
  events,
  isMember = false,
}: EventsListClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] =
    useState<ContentTranslations | null>(null);

  // Filter events based on search and category
  // Only show main events (collections or standalone, not collection items)
  const filteredEvents = events.filter((event) => {
    const eventData = event.event_ref;

    // Filter out member-only events if user is not a member
    if (eventData?.member_only && !isMember) {
      return false;
    }

    // Only show events that are collections OR don't belong to any collection
    const isMainEvent = eventData?.is_collection || !eventData?.collection_id;
    if (!isMainEvent) {
      return false;
    }

    const metadata = parseEventMetadata(eventData?.metadata);
    const category = getEventCategory(metadata);

    const matchesCategory =
      selectedCategory === "All" || category === selectedCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 border-gray-100 border-b bg-white/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-5 w-5 text-gray-400" />
              <Input
                className="w-full border-[#3DA9E0]/20 pr-10 pl-10 focus:border-[#3DA9E0]"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  className="-translate-y-1/2 absolute top-1/2 right-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Filter className="h-5 w-5 text-[#001731]" />
              {categories.map((category) => (
                <Button
                  className={
                    selectedCategory === category
                      ? "border-0 bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white"
                      : "border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                  }
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-gray-600">
            Showing {filteredEvents.length}{" "}
            {filteredEvents.length === 1 ? "event" : "events"}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
            exit={{ opacity: 0, y: -20 }}
            initial={{ opacity: 0, y: 20 }}
            key={selectedCategory + searchQuery}
          >
            {filteredEvents.map((event, index) => (
              <EventCard
                event={event}
                index={index}
                isMember={isMember}
                key={event.$id}
                onViewDetails={setSelectedEvent}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* No Results */}
        {filteredEvents.length === 0 && (
          <motion.div
            animate={{ opacity: 1 }}
            className="py-20 text-center"
            initial={{ opacity: 0 }}
          >
            <Calendar className="mx-auto mb-4 h-16 w-16 text-gray-300" />
            <h3 className="mb-2 font-bold text-2xl text-gray-900">
              No events found
            </h3>
            <p className="mb-6 text-gray-600">
              Try adjusting your filters or search query
            </p>
            <Button
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              variant="outline"
            >
              Clear Filters
            </Button>
          </motion.div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isMember={isMember}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  );
}
