"use client";

import { useEffect } from "react";
import type { Notification } from "./notifications-dropdown";
import { useNotifications } from "./use-notifications";

type NotificationsProviderProps = {
  children: React.ReactNode;
  initialNotifications?: Notification[];
};

export function NotificationsProvider({
  children,
  initialNotifications = [],
}: NotificationsProviderProps) {
  const { setNotifications } = useNotifications();

  useEffect(() => {
    if (initialNotifications.length > 0) {
      setNotifications(initialNotifications);
    }
  }, [initialNotifications, setNotifications]);

  // Poll for new notifications every 5 minutes
  useEffect(() => {
    const pollInterval = setInterval(
      async () => {
        try {
          const response = await fetch("/api/notifications");
          if (response.ok) {
            const notifications = await response.json();
            setNotifications(notifications);
          }
        } catch (error) {
          console.error(
            "[notifications] Failed to poll for notifications:",
            error
          );
        }
      },
      5 * 60 * 1000
    ); // 5 minutes

    return () => clearInterval(pollInterval);
  }, [setNotifications]);

  return <>{children}</>;
}
