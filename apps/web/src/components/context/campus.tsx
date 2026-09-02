"use client";

import type { Campus } from "@repo/api/types/appwrite";
import { trackEvent } from "@repo/shared/utils/analytics";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { setActiveCampus } from "@/app/actions/campus";

/**
 * Selected campus, with the server as the single source of truth.
 *
 * **What this replaces.** Campus previously lived in three places that
 * disagreed (00-current-state.md §6.5): the `campusId` cookie (read by every
 * server render), `localStorage["biso-active-campus"]` (read by this provider),
 * and an authenticated user's `prefs.campusId`. On a first visit the provider
 * defaulted to *the first campus in the list* while the server, seeing no
 * cookie, filtered *nothing* — so the switcher could display "Oslo" above
 * unfiltered national content.
 *
 * Now `SiteShell` resolves the campus server-side via `getActiveCampus()`
 * (cookie → user prefs → null) and passes it in. The provider holds only the
 * optimistic value between a click and the refresh that follows, so the label
 * and the content it describes cannot disagree.
 *
 * `localStorage` is gone. A stale key from before this change is simply never
 * read, so no migration is needed.
 *
 * The provider also no longer fetches on mount: `SiteShell` already has the
 * campus list, which removes a hydrate-then-fetch waterfall before the switcher
 * could render its own label.
 */
interface CampusContextValue {
  activeCampus?: Campus;
  activeCampusId: string | null;
  campuses: Campus[];
  /**
   * Retained for API compatibility with consumers that render a spinner. Always
   * false now — the campus list arrives with the first paint.
   */
  loading: boolean;
  /**
   * Persist a campus choice.
   *
   * `refresh` re-renders the server tree so the current page follows the new
   * cookie. The switcher passes `false` when it is also navigating — the
   * campus is in the URL it is going to, and refreshing the page being left
   * only pays for a render nobody sees.
   */
  selectCampus: (
    campusId: string | null,
    options?: { refresh?: boolean }
  ) => void;
}

const CampusContext = createContext<CampusContextValue | undefined>(undefined);

export const CampusProvider = ({
  children,
  campuses,
  initialCampusId,
}: {
  children: React.ReactNode;
  campuses: Campus[];
  /** Resolved server-side. `null` means "all campuses". */
  initialCampusId: string | null;
}) => {
  const router = useRouter();

  // Optimistic local value, reset whenever the server sends a new one. This is
  // React's documented "adjust state when a prop changes" pattern: after
  // `router.refresh()` the server re-renders with the new cookie, and the
  // switcher must follow the server rather than hold its own stale answer.
  const [selected, setSelected] = useState(initialCampusId);
  const [lastFromServer, setLastFromServer] = useState(initialCampusId);
  if (initialCampusId !== lastFromServer) {
    setLastFromServer(initialCampusId);
    setSelected(initialCampusId);
  }

  const selectCampus = useCallback(
    async (campusId: string | null, options?: { refresh?: boolean }) => {
      const normalized = campusId === "all" ? null : campusId;
      trackEvent("campus_switch", { to: normalized ?? "all" });
      setSelected(normalized);

      try {
        await setActiveCampus(normalized);
        // Re-render the server tree so every campus-scoped feed follows.
        if (options?.refresh !== false) {
          router.refresh();
        }
      } catch (error) {
        // Put the label back rather than leave it describing content that was
        // never fetched.
        setSelected(lastFromServer);
        console.error("Failed to persist campus selection:", error);
      }
    },
    [router, lastFromServer]
  );

  const value = useMemo<CampusContextValue>(
    () => ({
      campuses,
      activeCampusId: selected,
      activeCampus: campuses.find((campus) => campus.$id === selected),
      loading: false,
      selectCampus,
    }),
    [campuses, selected, selectCampus]
  );

  return (
    <CampusContext.Provider value={value}>{children}</CampusContext.Provider>
  );
};

export const useCampus = () => {
  const context = useContext(CampusContext);
  if (!context) {
    throw new Error("useCampus must be used within a CampusProvider");
  }
  return context;
};
