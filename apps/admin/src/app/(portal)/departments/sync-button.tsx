"use client";

import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";

interface SyncResponseBody {
  failed?: number;
  succeeded?: number;
  success?: boolean;
  total?: number;
}

export function SyncDepartmentsButton() {
  const syncDepartments = async () => {
    try {
      const response = await fetch("/api/units/sync", { method: "POST" });
      if (!response.ok) {
        toast.error("Failed to sync units");
        return;
      }

      // The route always answers 200 for a request that reached the sync
      // logic — a partial failure (some upserts rejected) is reported in the
      // JSON body, not the status code. Parse defensively: a non-JSON body
      // must not throw past this handler and must still surface as a failure
      // rather than a silent success toast.
      let body: SyncResponseBody | null = null;
      try {
        body = (await response.json()) as SyncResponseBody;
      } catch {
        toast.error("Sync response could not be read");
        return;
      }

      if (body?.success === false) {
        const failed = body.failed ?? "some";
        const total = body.total ?? "?";
        toast.error(`Synced with errors: ${failed} of ${total} failed`);
        return;
      }

      const succeeded = body?.succeeded;
      const total = body?.total;
      toast.success(
        succeeded !== undefined && total !== undefined
          ? `Units synced (${succeeded}/${total})`
          : "Units synced"
      );
    } catch {
      toast.error("Failed to sync units");
    }
  };

  return (
    <Button
      className="rounded-md bg-white/90 px-3 py-1 font-medium text-sm transition hover:bg-white"
      onClick={syncDepartments}
    >
      Sync units
    </Button>
  );
}
