"use client";

import type { Notification } from "@/components/notifications/notifications-dropdown";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";

export const AdminProviders = ({
  children,
  initialNotifications = [],
}: {
  children: React.ReactNode;
  initialNotifications?: Notification[];
}) => (
  <NotificationsProvider initialNotifications={initialNotifications}>
    {children}
  </NotificationsProvider>
);
