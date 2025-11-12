"use client";
import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { getCampuses } from "@/app/actions/campus";
import { Campus } from "@/lib/types/campus";
import { useHydration } from "@/lib/hooks/use-hydration";

type CampusContextValue = {
  campuses: Campus[];
  activeCampusId: string | null;
  activeCampus?: Campus;
  loading: boolean;
  selectCampus: (campusId: string | null) => void;
};

const CampusContext = createContext<CampusContextValue | undefined>(undefined);

const STORAGE_KEY = "biso-active-campus";

export const CampusProvider = ({ children }: { children: React.ReactNode }) => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [activeCampusId, setActiveCampusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isHydrated = useHydration();

  // Hydrate initial selection from localStorage so the choice persists between visits.
  useEffect(() => {
    if (!isHydrated) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      // Handle "all" selection
      if (stored === "all") {
        setActiveCampusId(null);
      } else {
        setActiveCampusId(stored);
      }
    }
  }, [isHydrated]);

  useEffect(() => {
    let isMounted = true;
    const loadCampuses = async () => {
      try {
        const response = (await getCampuses()) as Campus[];
        if (!isMounted) return;
        setCampuses(response);
        setLoading(false);

        if (response.length > 0) {
          setActiveCampusId((current) => {
            if (current && response.some((campus) => campus.$id === current)) {
              return current;
            }
            return response[0].$id;
          });
        }
      } catch (error) {
        console.error("Failed to load campuses", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCampuses();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (activeCampusId) {
      window.localStorage.setItem(STORAGE_KEY, activeCampusId);
    } else {
      // When no campus is selected (all campuses), store "all"
      window.localStorage.setItem(STORAGE_KEY, "all");
    }
  }, [activeCampusId, isHydrated]);

  const selectCampus = useCallback((campusId: string | null) => {
    // Handle "all" selection by setting to null
    if (campusId === "all") {
      setActiveCampusId(null);
    } else {
      setActiveCampusId(campusId);
    }
  }, []);

  const value = useMemo<CampusContextValue>(() => {
    const activeCampus = campuses.find((campus) => campus.$id === activeCampusId);
    return {
      campuses,
      activeCampusId,
      activeCampus,
      loading,
      selectCampus,
    };
  }, [campuses, activeCampusId, loading, selectCampus]);

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
};

export const useCampus = () => {
  const context = useContext(CampusContext);
  if (!context) {
    throw new Error("useCampus must be used within a CampusProvider");
  }
  return context;
};
