"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Bell,
  Briefcase,
  Calendar,
  CheckCheck,
  CheckCircle,
  Clock,
  FileText,
  Info,
  Loader2,
  Newspaper,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchNotifications,
  fetchPendingItems,
  type Notification,
  type NotificationType,
  type PendingItem,
} from "@/lib/actions/notifications";
import type { UserRolesForClient } from "@/lib/authorization";
import { MONO_STACK, STUDIO } from "../../app/(portal)/_components/studio";
import { useNotifications } from "./use-notifications";

const TYPE_ICON: Record<
  NotificationType,
  { icon: typeof Info; color: string; bg: string }
> = {
  info: {
    icon: Info,
    color: STUDIO.sky,
    bg: "rgba(42,74,122,0.08)",
  },
  success: {
    icon: CheckCircle,
    color: STUDIO.leaf,
    bg: "rgba(47,93,58,0.07)",
  },
  warning: {
    icon: AlertCircle,
    color: "#8a6200",
    bg: "rgba(176,138,62,0.09)",
  },
  error: {
    icon: XCircle,
    color: STUDIO.claret,
    bg: "rgba(107,30,30,0.07)",
  },
};

const CONTENT_TYPE_ICON = {
  job: Briefcase,
  event: Calendar,
  news: Newspaper,
};

interface NotificationsPanelProps {
  roles: UserRolesForClient;
}

export function NotificationsPanel({ roles }: NotificationsPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notices" | "pending">("notices");
  const [notices, setNotices] = useState<Notification[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);

  const { readIds, markAsRead, markAllAsRead } = useNotifications();

  const canSeePending = roles.isGlobalAdmin || roles.isCampusAdmin;

  const unreadNotices = notices.filter((n) => !readIds.includes(n.id));
  const totalBadge =
    unreadNotices.length + (canSeePending ? pendingItems.length : 0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setLoading(true);
    const fetches: [Promise<Notification[]>, Promise<PendingItem[]>] = [
      fetchNotifications(),
      canSeePending ? fetchPendingItems() : Promise.resolve([]),
    ];
    Promise.all(fetches)
      .then(([n, p]) => {
        setNotices(n);
        setPendingItems(p);
      })
      .finally(() => setLoading(false));
  }, [open, canSeePending]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative grid h-8 w-8 place-items-center rounded-lg border transition-colors hover:border-opacity-80"
          style={{
            background: open
              ? "rgba(255,255,255,0.8)"
              : "rgba(255,255,255,0.55)",
            borderColor: STUDIO.rule2,
            color: STUDIO.ink2,
          }}
          type="button"
        >
          <Bell size={15} />
          {totalBadge > 0 && (
            <span
              className="absolute top-1 right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full font-medium text-[9px] text-white"
              style={{
                background: STUDIO.claret,
                fontFamily: MONO_STACK,
              }}
            >
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="p-0"
        sideOffset={8}
        style={{
          background: STUDIO.white,
          border: `0.5px solid ${STUDIO.rule}`,
          borderRadius: 16,
          boxShadow:
            "0 20px 60px rgba(26,24,20,0.16), 0 4px 16px rgba(26,24,20,0.08)",
          width: 400,
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
        >
          <div className="flex items-center gap-2.5">
            <Bell size={14} style={{ color: STUDIO.ink3 }} />
            <span className="font-medium text-sm" style={{ color: STUDIO.ink }}>
              Notifications
            </span>
            {totalBadge > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 font-medium text-[11px]"
                style={{
                  background: "rgba(107,30,30,0.08)",
                  color: STUDIO.claret,
                  fontFamily: MONO_STACK,
                }}
              >
                {totalBadge}
              </span>
            )}
          </div>

          {unreadNotices.length > 0 && activeTab === "notices" && (
            <button
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:opacity-70"
              onClick={() => markAllAsRead(notices.map((n) => n.id))}
              style={{
                color: STUDIO.ink3,
                fontFamily: MONO_STACK,
              }}
              type="button"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs — only show if user can see pending */}
        {canSeePending && (
          <div
            className="flex"
            style={{ borderBottom: `0.5px solid ${STUDIO.rule}` }}
          >
            {(["notices", "pending"] as const).map((tab) => {
              const count =
                tab === "notices" ? unreadNotices.length : pendingItems.length;
              const label = tab === "notices" ? "Notices" : "Pending";
              const isActive = activeTab === tab;
              return (
                <button
                  className="flex flex-1 items-center justify-center gap-1.5 py-2.5 font-medium text-xs transition-colors"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    borderBottom: isActive
                      ? `1.5px solid ${STUDIO.ink}`
                      : "1.5px solid transparent",
                    color: isActive ? STUDIO.ink : STUDIO.ink3,
                    fontFamily: MONO_STACK,
                  }}
                  type="button"
                >
                  {label}
                  {count > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px]"
                      style={{
                        background:
                          tab === "pending"
                            ? "rgba(176,138,62,0.15)"
                            : "rgba(107,30,30,0.08)",
                        color: tab === "pending" ? "#8a6200" : STUDIO.claret,
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div
          className="overflow-y-auto"
          style={{ maxHeight: 420, scrollbarWidth: "thin" }}
        >
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2
                className="animate-spin"
                size={20}
                style={{ color: STUDIO.ink4 }}
              />
            </div>
          )}
          {!loading && activeTab === "notices" && (
            <NoticesTab
              markAsRead={markAsRead}
              notices={notices}
              onClose={() => setOpen(false)}
              readIds={readIds}
            />
          )}
          {!loading && activeTab === "pending" && (
            <PendingTab items={pendingItems} onClose={() => setOpen(false)} />
          )}
        </div>

        {/* Footer */}
        {activeTab === "pending" && pendingItems.length > 0 && (
          <div style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}>
            <Link
              className="flex w-full items-center justify-center py-2.5 text-xs transition-opacity hover:opacity-70"
              href="/drafts"
              onClick={() => setOpen(false)}
              style={{ color: STUDIO.ink3, fontFamily: MONO_STACK }}
            >
              View all drafts →
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NoticesTab({
  notices,
  readIds,
  markAsRead,
  onClose,
}: {
  markAsRead: (id: string) => void;
  notices: Notification[];
  onClose: () => void;
  readIds: string[];
}) {
  if (notices.length === 0) {
    return <EmptyState label="No active notices" />;
  }

  return (
    <div>
      {notices.map((notice) => {
        const isRead = readIds.includes(notice.id);
        const cfg = TYPE_ICON[notice.type];
        const Icon = cfg.icon;

        return (
          <button
            className="flex w-full gap-3 px-4 py-3 text-left transition-colors"
            key={notice.id}
            onClick={() => {
              if (!isRead) {
                markAsRead(notice.id);
              }
              if (notice.actionUrl) {
                window.location.href = notice.actionUrl;
                onClose();
              }
            }}
            style={{
              background: isRead ? "transparent" : "rgba(26,24,20,0.025)",
              borderBottom: `0.5px solid ${STUDIO.rule}`,
              cursor: notice.actionUrl ? "pointer" : "default",
            }}
            type="button"
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{ background: cfg.bg }}
            >
              <Icon size={14} style={{ color: cfg.color }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-sm leading-snug"
                  style={{
                    color: isRead ? STUDIO.ink3 : STUDIO.ink,
                    fontWeight: isRead ? 400 : 500,
                  }}
                >
                  {notice.title}
                </p>
                {!isRead && (
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: STUDIO.claret }}
                  />
                )}
              </div>
              {notice.message !== notice.title && (
                <p
                  className="mt-0.5 line-clamp-2 text-xs leading-relaxed"
                  style={{ color: STUDIO.ink4 }}
                >
                  {notice.message}
                </p>
              )}
              <div
                className="mt-1.5 flex items-center gap-1"
                style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
              >
                <Clock size={10} />
                <span className="text-[10px]">
                  {formatDistanceToNow(new Date(notice.timestamp), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PendingTab({
  items,
  onClose,
}: {
  items: PendingItem[];
  onClose: () => void;
}) {
  if (items.length === 0) {
    return <EmptyState label="No pending drafts" />;
  }

  return (
    <div>
      {items.map((item) => {
        const Icon = CONTENT_TYPE_ICON[item.type];
        return (
          <Link
            className="flex gap-3 px-4 py-3 transition-colors"
            href={item.editUrl}
            key={item.id}
            onClick={onClose}
            style={{
              borderBottom: `0.5px solid ${STUDIO.rule}`,
              display: "flex",
            }}
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
              style={{
                background: "rgba(176,138,62,0.09)",
              }}
            >
              <Icon size={14} style={{ color: "#8a6200" }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p
                  className="truncate text-sm"
                  style={{ color: STUDIO.ink, fontWeight: 500 }}
                >
                  {item.title}
                </p>
                <span
                  className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] uppercase"
                  style={{
                    background: "rgba(176,138,62,0.09)",
                    borderColor: "rgba(176,138,62,0.24)",
                    color: "#6a5118",
                    fontFamily: MONO_STACK,
                  }}
                >
                  {item.type}
                </span>
              </div>
              <div
                className="mt-1 flex items-center gap-1"
                style={{ color: STUDIO.ink4, fontFamily: MONO_STACK }}
              >
                <FileText size={10} />
                <span className="text-[10px]">Draft</span>
                <span style={{ color: STUDIO.rule2 }}>·</span>
                <Clock size={10} />
                <span className="text-[10px]">
                  {formatDistanceToNow(new Date(item.updatedAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 py-12"
      style={{ color: STUDIO.ink4 }}
    >
      <Bell size={20} style={{ color: STUDIO.rule2 }} />
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        {label}
      </p>
    </div>
  );
}
