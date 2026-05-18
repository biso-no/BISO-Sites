"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface NotificationsState {
  clearReadIds: () => void;
  markAllAsRead: (ids: string[]) => void;
  markAsRead: (id: string) => void;
  readIds: string[];
}

export const useNotifications = create<NotificationsState>()(
  persist(
    (set) => ({
      readIds: [],

      markAsRead: (id) =>
        set((state) => ({
          readIds: state.readIds.includes(id)
            ? state.readIds
            : [...state.readIds, id],
        })),

      markAllAsRead: (ids) =>
        set((state) => ({
          readIds: [...new Set([...state.readIds, ...ids])],
        })),

      clearReadIds: () => set({ readIds: [] }),
    }),
    {
      name: "admin-notifications-read",
      partialize: (state) => ({ readIds: state.readIds }),
    }
  )
);
