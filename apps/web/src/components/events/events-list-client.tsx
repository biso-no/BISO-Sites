"use client";

import type { ContentTranslations } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Calendar, Filter, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { eventCategories, getEventCategory, parseEventMetadata } from "@/lib/types/event";
import { EventCard } from "./event-card";
import { EventDetailModal } from "./event-detail-modal";

interface EventsListClientProps {
  events: ContentTranslations[];
  isMember?: boolean;
}

const categories = ["All", ...eventCategories] as const;

export function EventsListClient({ events, isMember = false }: EventsListClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<ContentTranslations | null>(null);

  // Filter events based on search and category
  // Only show main events (collections or standalone, not collection items)
  const filteredEvents = events.filter((event) => {
    const eventData = event.event_ref;

    // Filter out member-only events if user is not a member
    if (eventData?.member_only && !isMember) return false;

    // Only show events that are collections OR don't belong to any collection
    const isMainEvent = eventData?.is_collection || !eventData?.collection_id;
    if (!isMainEvent) return false;

    const metadata = parseEventMetadata(eventData?.metadata);
    const category = getEventCategory(metadata);

    const matchesCategory = selectedCategory === "All" || category === selectedCategory;
    const matchesSearch =
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 w-full border-[#3DA9E0]/20 focus:border-[#3DA9E0]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Filter className="w-5 h-5 text-[#001731]" />
              {categories.map((category) => (
                <Button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className={
                    selectedCategory === category
                      ? "bg-linear-to-r from-[#3DA9E0] to-[#001731] text-white border-0"
                      : "border-[#3DA9E0]/20 text-[#001731] hover:bg-[#3DA9E0]/10"
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4 text-center text-gray-600">
            Showing {filteredEvents.length} {filteredEvents.length === 1 ? "event" : "events"}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedCategory + searchQuery}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {filteredEvents.map((event, index) => (
              <EventCard
                key={event.$id}
                event={event}
                index={index}
                isMember={isMember}
                onViewDetails={setSelectedEvent}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* No Results */}
        {filteredEvents.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="mb-2 text-gray-900 text-2xl font-bold">No events found</h3>
            <p className="text-gray-600 mb-6">Try adjusting your filters or search query</p>
            <Button
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              variant="outline"
              className="border-[#3DA9E0] text-[#001731] hover:bg-[#3DA9E0]/10"
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
