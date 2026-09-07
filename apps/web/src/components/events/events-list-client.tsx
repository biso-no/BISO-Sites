"use client";

import type { Events, EventsCategory } from "@repo/api/types/appwrite";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { useListParams, useUrlSearch } from "@repo/ui/hooks/use-list-params";
import { Calendar, Filter, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { listEvents } from "@/app/actions/events";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { EVENT_CATEGORY_MESSAGE_KEYS } from "@/lib/types/event";
import { useLoadMore } from "@/lib/use-load-more";
import { EventCard } from "./event-card";
import { EventDetailModal } from "./event-detail-modal";

interface EventsListClientProps {
  campus: string;
  capped: boolean;
  categories: EventsCategory[];
  initialEvents: Events[];
  initialSearch: string;
  isMember?: boolean;
  locale: "en" | "no";
  selectedCategory: string | null;
  total: number;
}

export function EventsListClient({
  campus,
  capped,
  categories,
  initialEvents,
  initialSearch,
  isMember = false,
  locale,
  selectedCategory,
  total,
}: EventsListClientProps) {
  const t = useTranslations("events");
  const { setParams } = useListParams();
  const [searchValue, setSearchValue] = useUrlSearch("q");
  const [selectedEvent, setSelectedEvent] = useState<Events | null>(null);

  const { canLoadMore, error, isLoading, items, loadMore } = useLoadMore({
    initial: initialEvents,
    total,
    fetchPage: useCallback(
      (page: number) =>
        listEvents({
          campus,
          category: selectedCategory,
          isMember,
          locale,
          page,
          search: initialSearch,
          status: "published",
          upcomingOnly: true,
        }),
      [campus, selectedCategory, isMember, locale, initialSearch]
    ),
  });

  function clearAllFilters() {
    setSearchValue("");
    setParams({ category: null });
  }

  const hasActiveFilters = searchValue.length > 0 || selectedCategory !== null;

  return (
    <>
      {/* Filters & Search */}
      <div className="sticky top-20 z-40 border-border border-b bg-background/95 shadow-lg backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Search */}
            <div className="relative w-full md:w-96">
              <Search className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="w-full border-brand-border pr-10 pl-10 focus:border-brand"
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t("filters.searchPlaceholder")}
                type="text"
                value={searchValue}
              />
              {searchValue && (
                <button
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  onClick={() => setSearchValue("")}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter */}
            {categories.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Filter className="h-5 w-5 text-brand-dark" />
                <Button
                  className={
                    selectedCategory === null
                      ? "border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white"
                      : "border-brand-border text-brand-dark hover:bg-brand-muted"
                  }
                  onClick={() => setParams({ category: null })}
                  variant={selectedCategory === null ? "default" : "outline"}
                >
                  {t("filters.all")}
                </Button>
                {categories.map((category) => (
                  <Button
                    className={
                      selectedCategory === category
                        ? "border-0 bg-linear-to-r from-brand-gradient-from to-brand-gradient-to text-white"
                        : "border-brand-border text-brand-dark hover:bg-brand-muted"
                    }
                    key={category}
                    onClick={() => setParams({ category })}
                    variant={
                      selectedCategory === category ? "default" : "outline"
                    }
                  >
                    {t(`filters.${EVENT_CATEGORY_MESSAGE_KEYS[category]}`)}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 text-center text-muted-foreground">
            {capped
              ? t("filters.showingFirstResults", { count: total })
              : t("filters.showingResults", { count: total })}
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
            key="events-grid"
          >
            {items.map((event, index) => (
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
        {items.length === 0 && (
          <motion.div
            animate={{ opacity: 1 }}
            className="py-20 text-center"
            initial={{ opacity: 0 }}
          >
            <Calendar className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 font-bold text-2xl text-foreground">
              {t("emptyState.title")}
            </h3>
            <p className="mb-6 text-muted-foreground">
              {t("emptyState.description")}
            </p>
            {hasActiveFilters && (
              <Button
                className="border-brand text-brand-dark hover:bg-brand-muted"
                onClick={clearAllFilters}
                variant="outline"
              >
                {t("filters.clearFilters")}
              </Button>
            )}
          </motion.div>
        )}

        <LoadMoreButton
          canLoadMore={canLoadMore}
          error={error}
          isLoading={isLoading}
          label={t("filters.loadMore")}
          loadingLabel={t("filters.loading")}
          onLoadMore={loadMore}
          retryLabel={t("filters.loadMoreFailed")}
        />
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
