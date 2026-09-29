"use client";

import { Button } from "@repo/ui/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshMemberRoster } from "../../_actions/members";
import { STUDIO } from "../../_components/studio";

interface RosterRefreshProps {
  canRefresh: boolean;
  labels: {
    alreadyRunning: string;
    failed: string;
    notConfigured: string;
    queued: string;
    refresh: string;
    refreshing: string;
  };
  running: boolean;
  statusText: string;
}

export function RosterRefresh({
  canRefresh,
  labels,
  running,
  statusText,
}: RosterRefreshProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const busy = running || pending;

  function onRefresh() {
    startTransition(async () => {
      const result = await refreshMemberRoster();
      if (result.ok) {
        setMessage(labels.queued);
      } else if (result.reason === "already-running") {
        setMessage(labels.alreadyRunning);
      } else if (result.reason === "not-configured") {
        setMessage(labels.notConfigured);
      } else if (result.reason === "failed") {
        setMessage(labels.failed);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p aria-live="polite" className="text-xs" style={{ color: STUDIO.ink3 }}>
        {message ?? (running ? labels.refreshing : statusText)}
      </p>
      {canRefresh ? (
        <Button disabled={busy} onClick={onRefresh} size="sm" variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          {busy ? labels.refreshing : labels.refresh}
        </Button>
      ) : null}
    </div>
  );
}
