"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Notification,
  NotificationPriority,
  NotificationType,
} from "./notifications-dropdown";

type NotificationsState = {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;
  setNotifications: (notifications: Notification[]) => void;
};

export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notification) =>
        set((state) => {
          const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            read: false,
          };

          const notifications = [newNotification, ...state.notifications].slice(
            0,
            50
          ); // Keep last 50
          const unreadCount = notifications.filter((n) => !n.read).length;

          return { notifications, unreadCount };
        }),

      markAsRead: (id) =>
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );
          const unreadCount = notifications.filter((n) => !n.read).length;

          return { notifications, unreadCount };
        }),

      markAllAsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      deleteNotification: (id) =>
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          const unreadCount = notifications.filter((n) => !n.read).length;

          return { notifications, unreadCount };
        }),

      clearAll: () =>
        set({
          notifications: [],
          unreadCount: 0,
        }),

      setNotifications: (notifications) =>
        set({
          notifications,
          unreadCount: notifications.filter((n) => !n.read).length,
        }),
    }),
    {
      name: "admin-notifications-storage",
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);

// Helper function to create notifications
export const createNotification = {
  success: (
    title: string,
    message: string,
    options?: Partial<Notification>
  ) => ({
    type: "success" as NotificationType,
    priority: "medium" as NotificationPriority,
    title,
    message,
    ...options,
  }),

  error: (title: string, message: string, options?: Partial<Notification>) => ({
    type: "error" as NotificationType,
    priority: "high" as NotificationPriority,
    title,
    message,
    ...options,
  }),

  warning: (
    title: string,
    message: string,
    options?: Partial<Notification>
  ) => ({
    type: "warning" as NotificationType,
    priority: "medium" as NotificationPriority,
    title,
    message,
    ...options,
  }),

  info: (title: string, message: string, options?: Partial<Notification>) => ({
    type: "info" as NotificationType,
    priority: "low" as NotificationPriority,
    title,
    message,
    ...options,
  }),
};
