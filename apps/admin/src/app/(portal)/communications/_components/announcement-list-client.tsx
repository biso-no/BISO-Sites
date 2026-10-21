"use client";

import type { Announcements } from "@repo/api/types/appwrite";
import { Megaphone, Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { audienceLabel } from "@/lib/announcements/audience-label";
import { deleteAnnouncement } from "../../_actions/announcements";
import { ANNOUNCEMENTS_PAGE_SIZE } from "../../_actions/schemas";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { PortalButton } from "../../_components/portal-button";
import { StatusBadge } from "../../_components/status-badge";
import { STUDIO, studioSurface } from "../../_components/studio";
import { useListParams } from "../../_components/use-list-params";
import { TYPE_CARDS } from "./composer/composer-state";
import { SOURCE_FILTERS, type SourceFilter } from "./source-filter";

interface AnnouncementListClientProps {
  initialAnnouncements: Announcements[];
  page: number;
  segmentNames?: Record<string, string>;
  source?: SourceFilter;
  total: number;
}

function typeLabel(category: string): string {
  const card = TYPE_CARDS.find((type) => type.id === category);
  if (card) {
    return card.label;
  }
  return category
    ? `${category.charAt(0).toUpperCase()}${category.slice(1)}`
    : "";
}

function SourceFilterTabs({ source }: { source: SourceFilter }) {
  const { setParams } = useListParams();
  return (
    <fieldset
      aria-label="Filter by how it was sent"
      className="mb-4 inline-flex gap-1 rounded-xl p-1"
      style={{
        background: STUDIO.paper2,
        border: `0.5px solid ${STUDIO.rule2}`,
      }}
    >
      {SOURCE_FILTERS.map((filter) => {
        const active = filter.id === source;
        return (
          <button
            aria-pressed={active}
            className="cursor-pointer rounded-lg px-3 py-1 font-medium text-xs"
            key={filter.id}
            onClick={() =>
              setParams({ source: filter.id === "all" ? null : filter.id })
            }
            style={
              active
                ? { background: STUDIO.ink, color: STUDIO.white }
                : { color: STUDIO.ink2 }
            }
            type="button"
          >
            {filter.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function AnnouncementListClient({
  initialAnnouncements,
  page,
  segmentNames = {},
  source = "all",
  total,
}: AnnouncementListClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Two-step confirm: first click arms the destructive action, second runs it.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    startTransition(async () => {
      const result = await deleteAnnouncement(id);
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to delete announcement"
        );
        return;
      }
      toast.success("Announcement deleted");
      router.refresh();
    });
  }

  if (initialAnnouncements.length === 0 && source !== "all") {
    return (
      <div>
        <SourceFilterTabs source={source} />
        <EmptyState
          description="Try another filter to see the rest of your notifications."
          icon={<Megaphone size={26} />}
          title={
            source === "auto"
              ? "No automatic notifications"
              : "No manual notifications"
          }
        />
      </div>
    );
  }

  if (initialAnnouncements.length === 0) {
    return (
      <EmptyState
        description="Create your first announcement to push a message to the BISO app."
        icon={<Megaphone size={26} />}
        title="No announcements yet"
      >
        <Link href="/communications/new">
          <PortalButton variant="primary">New announcement</PortalButton>
        </Link>
      </EmptyState>
    );
  }

  return (
    <div>
      <SourceFilterTabs source={source} />
      <div className="space-y-3">
        {initialAnnouncements.map((announcement) => {
          // `sent` rows can't be re-sent; the server refuses it anyway. The
          // others go through the composer's Check & send step, so every send
          // gets its confirmations and checks.
          const canSend =
            announcement.status === "draft" ||
            announcement.status === "scheduled" ||
            announcement.status === "failed";
          return (
            <div
              className="flex items-center gap-4 rounded-2xl px-5 py-4"
              key={announcement.$id}
              style={studioSurface}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p
                    className="truncate font-medium text-sm"
                    style={{ color: STUDIO.ink }}
                  >
                    {announcement.title_no?.trim() || announcement.title_en}
                  </p>
                  <StatusBadge status={announcement.status} />
                  {announcement.source === "auto" && (
                    <span
                      className="rounded-full px-2 py-0.5 font-medium text-[11px]"
                      style={{
                        background: STUDIO.paper2,
                        border: `0.5px solid ${STUDIO.rule2}`,
                        color: STUDIO.ink2,
                      }}
                    >
                      Automatic
                    </span>
                  )}
                </div>
                <p
                  className="mt-1 truncate text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  {audienceLabel(
                    announcement,
                    segmentNames[announcement.audience_value ?? ""]
                  )}
                  {" · "}
                  {typeLabel(announcement.category)}
                  {announcement.sent_at
                    ? ` · sent ${new Date(announcement.sent_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canSend && (
                  <Link href={`/communications/${announcement.$id}?step=check`}>
                    <PortalButton size="sm" variant="primary">
                      <Send size={13} />
                      Review & send
                    </PortalButton>
                  </Link>
                )}
                <Link href={`/communications/${announcement.$id}`}>
                  <PortalButton size="sm" variant="secondary">
                    <Pencil size={13} />
                    Edit
                  </PortalButton>
                </Link>
                <PortalButton
                  disabled={isPending}
                  onClick={() => handleDelete(announcement.$id)}
                  size="sm"
                  variant="danger"
                >
                  <Trash2 size={13} />
                  {confirmDeleteId === announcement.$id ? "Confirm" : ""}
                </PortalButton>
              </div>
            </div>
          );
        })}
      </div>

      <PaginationBar page={page} size={ANNOUNCEMENTS_PAGE_SIZE} total={total} />
    </div>
  );
}
