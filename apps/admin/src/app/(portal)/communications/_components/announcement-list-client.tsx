"use client";

import type { Announcements } from "@repo/api/types/appwrite";
import { Megaphone, Pencil, Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  deleteAnnouncement,
  sendAnnouncement,
} from "../../_actions/announcements";
import { ANNOUNCEMENTS_PAGE_SIZE } from "../../_actions/schemas";
import { EmptyState } from "../../_components/empty-state";
import { PaginationBar } from "../../_components/pagination-bar";
import { PortalButton } from "../../_components/portal-button";
import { StatusBadge } from "../../_components/status-badge";
import { STUDIO, studioSurface } from "../../_components/studio";

interface AnnouncementListClientProps {
  initialAnnouncements: Announcements[];
  page: number;
  total: number;
}

const AUDIENCE_LABELS: Record<string, string> = {
  broadcast: "All app users",
  topic: "Topic",
  users: "Specific users",
  segment: "Segment",
};

export function AnnouncementListClient({
  initialAnnouncements,
  page,
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

  function handleSend(id: string) {
    startTransition(async () => {
      const result = await sendAnnouncement(id);
      if (result.error) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Failed to send announcement"
        );
        return;
      }
      toast.success(
        result.data?.status === "scheduled"
          ? "Announcement scheduled"
          : "Announcement sent"
      );
      router.refresh();
    });
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
      <div className="space-y-3">
        {initialAnnouncements.map((announcement) => {
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
                </div>
                <p
                  className="mt-1 truncate text-xs"
                  style={{ color: STUDIO.ink3 }}
                >
                  {AUDIENCE_LABELS[announcement.audience_type] ??
                    announcement.audience_type}
                  {" · "}
                  {announcement.category}
                  {announcement.sent_at
                    ? ` · sent ${new Date(announcement.sent_at).toLocaleDateString()}`
                    : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {canSend && (
                  <PortalButton
                    disabled={isPending}
                    onClick={() => handleSend(announcement.$id)}
                    size="sm"
                    variant="primary"
                  >
                    <Send size={13} />
                    Send
                  </PortalButton>
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
