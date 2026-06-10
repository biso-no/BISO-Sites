"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { MembershipStatus } from "@/lib/actions/membership";

type MembershipContextValue = MembershipStatus & {
  loading: boolean;
  refresh: () => Promise<void>;
};

const MembershipContext = createContext<MembershipContextValue | null>(null);

interface MembershipProviderProps {
  children: React.ReactNode;
  /**
   * Initial membership status from server-side.
   * If provided, skips the initial fetch.
   */
  initialStatus?: MembershipStatus;
}

export const MembershipProvider = ({
  children,
  initialStatus,
}: MembershipProviderProps) => {
  const [status, setStatus] = useState<MembershipStatus>(
    initialStatus ?? {
      isMember: false,
      memberships: [],
      finagoCategoryIds: [],
      checkedAt: 0,
    }
  );
  const [loading, setLoading] = useState(!initialStatus);

  const fetchMembership = useCallback(async (forceRefresh = false) => {
    try {
      const url = forceRefresh
        ? "/api/membership?refresh=true"
        : "/api/membership";
      const response = await fetch(url);
      const data: MembershipStatus = await response.json();

      setStatus(data);
    } catch (error) {
      console.error("Error checking membership:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchMembership(true);
  }, [fetchMembership]);

  useEffect(() => {
    // If no initial status provided, fetch on mount
    if (!initialStatus) {
      fetchMembership(false);
    }
  }, [initialStatus, fetchMembership]);

  return (
    <MembershipContext.Provider value={{ ...status, loading, refresh }}>
      {children}
    </MembershipContext.Provider>
  );
};

/**
 * Hook to access membership status in client components.
 *
 * @example
 * ```tsx
 * const { isMember, memberships, loading, refresh } = useUserMembership();
 *
 * if (loading) return <Spinner />;
 * if (isMember) return <MemberContent />;
 * return <NonMemberContent />;
 * ```
 */
const _useUserMembership = () => {
  const context = useContext(MembershipContext);
  if (!context) {
    throw new Error(
      "useUserMembership must be used within a MembershipProvider"
    );
  }
  return context;
};
