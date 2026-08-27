"use client";

import { Button } from "@repo/ui/components/ui/button";
import { toast } from "sonner";

export function SyncDepartmentsButton() {
  const syncDepartments = async () => {
    try {
      const response = await fetch("/api/units/sync", { method: "POST" });
      if (!response.ok) {
        toast.error("Failed to sync units");
        return;
      }
      toast.success("Units synced");
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
