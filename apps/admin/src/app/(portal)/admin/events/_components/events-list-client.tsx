"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { deleteEvent } from "../../_actions/events";
import { SearchToolbar } from "../../_components/search-toolbar";
import { StatusBadge } from "../../_components/status-badge";
import { EmptyState } from "../../_components/empty-state";
import type { Events, ContentTranslations } from "@repo/api/types/appwrite";

type EventWithTranslations = Events & { translation_refs: ContentTranslations[] };

type EventsListClientProps = {
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
};

export function EventsListClient({ initialEvents, labels }: EventsListClientProps) {
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
    return event.translation_refs.find((t) => t.locale === "no")?.title ?? "Untitled";
  }



  function handleDelete(id: string) {
    if (!confirm(labels.deleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteEvent(id);
      if (result.error) {
        toast.error("Failed to delete event");
      } else {
        toast.success("Event deleted");
      }
    });
  }

  if (initialEvents.length === 0) {
    return (
      <EmptyState icon={<Calendar size={28} />} title={labels.empty} description={labels.emptyDescription}>
        <Link href="/admin/events/new" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#3DA9E0", color: "#001731" }}>
          Create first event
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <SearchToolbar placeholder={labels.searchPlaceholder} onSearch={setSearch} filters={filters} activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {initialEvents.length === 0 ? (
        <EmptyState icon={<Calendar size={28} />} title="No matching events" description="Try adjusting your search or filters." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {initialEvents.map((event) => (
            <div
              key={event.$id}
              className="group rounded-3xl overflow-hidden transition-all"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Image */}
              <div className="relative h-36 overflow-hidden" style={{ background: "rgba(61,169,224,0.05)" }}>
                {event.image ? (
                  <img src={event.image} alt={getTitle(event)} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Calendar size={28} style={{ color: "rgba(255,255,255,0.20)" }} />
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <StatusBadge status={event.status} />
                </div>
                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link href={`/admin/events/${event.$id}`} className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "rgba(0,0,0,0.60)", color: "#fff" }}>
                    <Pencil size={12} />
                  </Link>
                  <button type="button" onClick={() => handleDelete(event.$id)} className="flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: "rgba(0,0,0,0.60)", color: "#f87171" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <Link href={`/admin/events/${event.$id}`} className="font-medium text-sm hover:text-[#3DA9E0] transition-colors" style={{ color: "#fff" }}>
                  {getTitle(event)}
                </Link>
                <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {event.start_date && (
                    <span>{new Date(event.start_date).toLocaleDateString()}</span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={10} />
                      {event.location}
                    </span>
                  )}
                  {event.price != null && (
                    <span>{event.price === 0 ? "Free" : `${event.price} NOK`}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
