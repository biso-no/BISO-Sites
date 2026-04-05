"use client";

import type { ContentTranslations, Events } from "@repo/api/types/appwrite";
import { Calendar, MapPin, Pencil, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEvent } from "../../_actions/events";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";

type EventWithTranslations = Events & {
  translation_refs: ContentTranslations[];
};

interface EventsListClientProps {
  initialEvents: Events[];
  labels: {
    empty: string;
    emptyDescription: string;
    searchPlaceholder: string;
    all: string;
    published: string;
    draft: string;
    cancelled: string;
    edit: string;
    delete: string;
    deleteConfirm: string;
  };
  page: number;
  total: number;
}

export function EventsListClient({
  initialEvents,
  total,
  page,
  labels,
}: EventsListClientProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [, startTransition] = useTransition();

  const filters = [
    { label: labels.all, value: "all" },
    { label: labels.published, value: "published" },
    { label: labels.draft, value: "draft" },
    { label: labels.cancelled, value: "cancelled" },
  ];

  function getTitle(event: Events) {
    const refs = (event as EventWithTranslations).translation_refs;
    return refs?.find((t) => t.locale === "no")?.title ?? "Untitled";
  }

  const filtered = (initialEvents as EventWithTranslations[]).filter(
    (event) => {
      const title = getTitle(event);
      return (
        (!search || title.toLowerCase().includes(search.toLowerCase())) &&
        (activeFilter === "all" || event.status === activeFilter)
      );
    }
  );

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteEvent(id);
      if (result.error) {
        toast.error("Failed to delete event");
      } else {
        toast.success("Event deleted");
      }
    });
  }

  if (initialEvents.length === 0 && page === 1) {
    return (
      <EmptyState
        description={labels.emptyDescription}
        icon={<Calendar size={28} />}
        title={labels.empty}
      >
        <Link
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-medium text-sm"
          href="/events/new"
          style={{ background: "#3DA9E0", color: "#001731" }}
        >
          Create first event
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar
        activeFilter={activeFilter}
        filters={filters}
        onFilterChange={setActiveFilter}
        onSearch={setSearch}
        placeholder={labels.searchPlaceholder}
      />

      {filtered.length === 0 ? (
        <EmptyState
          description="Try adjusting your search or filters."
          icon={<Calendar size={28} />}
          title="No matching events"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((event) => (
            <div
              className="group overflow-hidden rounded-3xl transition-all"
              key={event.$id}
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <div
                className="relative h-36 overflow-hidden"
                style={{ background: "rgba(61,169,224,0.05)" }}
              >
                {event.image ? (
                  <Image
                    alt={getTitle(event)}
                    className="object-cover"
                    fill
                    src={event.image}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Calendar
                      size={28}
                      style={{ color: "rgba(255,255,255,0.20)" }}
                    />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <StatusBadge status={event.status} />
                </div>
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Link
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    href={`/admin/events/${event.$id}`}
                    style={{ background: "rgba(0,0,0,0.60)", color: "#fff" }}
                  >
                    <Pencil size={12} />
                  </Link>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    onClick={() => handleDelete(event.$id)}
                    style={{ background: "rgba(0,0,0,0.60)", color: "#f87171" }}
                    type="button"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="p-4">
                <Link
                  className="font-medium text-sm transition-colors hover:text-[#3DA9E0]"
                  href={`/admin/events/${event.$id}`}
                  style={{ color: "#fff" }}
                >
                  {getTitle(event)}
                </Link>
                <div
                  className="mt-2 flex items-center gap-3 text-xs"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {event.start_date && (
                    <span>
                      {new Date(event.start_date).toLocaleDateString()}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} />
                      {event.location}
                    </span>
                  )}
                  {event.price != null && (
                    <span>
                      {event.price === 0 ? "Free" : `${event.price} NOK`}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationBar page={page} total={total} />
    </>
  );
}
