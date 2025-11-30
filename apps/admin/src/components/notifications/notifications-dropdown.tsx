"use client";

import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle,
  Clock,
  Info,
  XCircle,
} from "lucide-react";
import { type ComponentType, useState } from "react";
import { useNotifications } from "./use-notifications";

export type NotificationType = "success" | "error" | "warning" | "info";
export type NotificationPriority = "low" | "medium" | "high";

export type Notification = {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
};

const typeConfig: Record<
  NotificationType,
  {
    icon: ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
  }
> = {
  success: {
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-500/20",
  },
  error: {
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-500/20",
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-500/20",
  },
  info: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-500/20",
  },
};

export function NotificationsDropdown() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
      setOpen(false);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <DropdownMenu onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <Button
          className="relative h-10 w-10 rounded-xl border border-primary/10 bg-white/70 text-primary-80 hover:bg-primary/5 dark:border-primary/20 dark:bg-card/70 dark:text-primary dark:hover:bg-primary/10"
          size="icon"
          variant="ghost"
        >
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary-100 font-semibold text-[10px] text-white"
                exit={{ scale: 0 }}
                initial={{ scale: 0 }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[420px] rounded-2xl border border-primary/10 bg-white/95 shadow-[0_25px_50px_-20px_rgba(0,23,49,0.5)] backdrop-blur-xl dark:border-primary/20 dark:bg-card/95"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary-60" />
            <span className="font-semibold text-foreground text-sm">
              Notifications
            </span>
            {unreadCount > 0 && (
              <Badge className="h-5 px-2 text-xs" variant="secondary">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              className="h-7 text-primary-60 text-xs hover:text-primary-100"
              onClick={handleMarkAllAsRead}
              size="sm"
              variant="ghost"
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 rounded-full bg-primary/5 p-3">
                <Bell className="h-6 w-6 text-primary-40" />
              </div>
              <p className="font-medium text-foreground text-sm">
                All caught up!
              </p>
              <p className="mt-1 text-muted-foreground text-xs">
                No new notifications
              </p>
            </div>
          ) : (
            <DropdownMenuGroup>
              {notifications.map((notification) => {
                const config = typeConfig[notification.type];
                const Icon = config.icon;

                return (
                  <DropdownMenuItem
                    className={cn(
                      "flex cursor-pointer gap-3 px-4 py-3 focus:bg-primary/5",
                      !notification.read && "bg-primary/5 dark:bg-primary/10"
                    )}
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        config.bgColor
                      )}
                    >
                      <Icon className={cn("h-4 w-4", config.color)} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "font-medium text-sm",
                            !notification.read && "text-foreground",
                            notification.read && "text-muted-foreground"
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="mt-1 h-2 w-2 rounded-full bg-secondary-100" />
                        )}
                      </div>
                      <p className="line-clamp-2 text-muted-foreground text-xs">
                        {notification.message}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground text-xs">
                          {formatDistanceToNow(
                            new Date(notification.timestamp),
                            {
                              addSuffix: true,
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-2">
              <Button
                className="w-full text-primary-60 text-xs hover:text-primary-100"
                onClick={() => {
                  // Navigate to notifications page when it's created
                  setOpen(false);
                }}
                size="sm"
                variant="ghost"
              >
                View all notifications
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
