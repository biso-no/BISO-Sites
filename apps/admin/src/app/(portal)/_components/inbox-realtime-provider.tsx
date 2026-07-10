"use client";

import type { RealtimeResponseEvent } from "@repo/api/realtime";
import {
  getRealtime,
  setRealtimeSession,
  tableRowsChannel,
  useRealtimeChannels,
} from "@repo/api/realtime";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  eventTouchesTable,
  isCreateEvent,
  shouldNotifyForCampus,
} from "@/lib/inbox-realtime";
import type { InboxCounts } from "../_actions/inbox";
import { getInboxCounts } from "../_actions/inbox";
import { getRealtimeSessionSecret } from "../_actions/realtime";

const REFRESH_DEBOUNCE_MS = 500;
const APPROVALS_TABLE = "approval_requests";
const SUBMISSIONS_TABLE = "form_submissions";
const CHANNELS = [
  tableRowsChannel("app", APPROVALS_TABLE),
  tableRowsChannel("app", SUBMISSIONS_TABLE),
];

const InboxCountsContext = createContext<InboxCounts | null>(null);

export function useInboxCounts(): InboxCounts | null {
  return useContext(InboxCountsContext);
}

interface InboxRealtimeProviderProps {
  activeCampusId: string | null;
  children: React.ReactNode;
  initialCounts: InboxCounts;
  isApprover: boolean;
}

export function InboxRealtimeProvider({
  activeCampusId,
  children,
  initialCounts,
  isApprover,
}: InboxRealtimeProviderProps) {
  const t = useTranslations("adminPortal.inboxRealtime");
  const router = useRouter();
  const pathname = usePathname();
  const [counts, setCounts] = useState<InboxCounts>(initialCounts);
  const [sessionReady, setSessionReady] = useState(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server re-renders (navigation, campus switch) pass fresh counts; the
  // server value is authoritative and must win over stale client state.
  useEffect(() => {
    setCounts(initialCounts);
  }, [initialCounts]);

  // Collapse event bursts into one refetch; lists on /inbox/* re-render via
  // router.refresh() so all campus/role scoping stays server-side (spec §3).
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) {
      return;
    }
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      getInboxCounts()
        .then(setCounts)
        .catch(() => {
          /* keep last known counts */
        });
      if (pathnameRef.current?.startsWith("/inbox")) {
        router.refresh();
      }
    }, REFRESH_DEBOUNCE_MS);
  }, [router]);

  // Session bridge: authenticate the shared browser client once per mount.
  useEffect(() => {
    if (!isApprover) {
      return;
    }
    let cancelled = false;
    getRealtimeSessionSecret()
      .then((secret) => {
        if (cancelled || !secret) {
          return;
        }
        setRealtimeSession(secret);
        setSessionReady(true);
      })
      .catch(() => {
        // No session -> no socket; page keeps request/response behavior.
        console.warn("[realtime] session bridge failed");
      });
    return () => {
      cancelled = true;
    };
  }, [isApprover]);

  // Cover event gaps: refetch once on socket (re)open and when the tab
  // returns to the foreground. onOpen has no unregister; the debounce makes
  // duplicate registrations (StrictMode) harmless.
  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    getRealtime().onOpen(scheduleRefresh);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [sessionReady, scheduleRefresh]);

  const handleEvent = useCallback(
    (event: RealtimeResponseEvent<Record<string, unknown>>) => {
      scheduleRefresh();
      if (!isCreateEvent(event.events)) {
        return;
      }
      const payload = event.payload;
      const payloadCampusId =
        typeof payload.campus_id === "string" ? payload.campus_id : null;
      if (!shouldNotifyForCampus(payloadCampusId, activeCampusId)) {
        return;
      }
      const isApproval = eventTouchesTable(event.events, APPROVALS_TABLE);
      const message = isApproval
        ? t("newApproval", {
            email:
              typeof payload.requester_email === "string"
                ? payload.requester_email
                : "",
          })
        : t("newSubmission");
      const target = isApproval ? "/inbox/approvals" : "/inbox/submissions";
      toast(message, {
        action: { label: t("open"), onClick: () => router.push(target) },
      });
    },
    [activeCampusId, router, scheduleRefresh, t]
  );

  useRealtimeChannels({
    channels: CHANNELS,
    enabled: isApprover && sessionReady,
    onEvent: handleEvent,
  });

  return (
    <InboxCountsContext.Provider value={counts}>
      {children}
    </InboxCountsContext.Provider>
  );
}
