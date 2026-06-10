"use client";

import { Button } from "@repo/ui/components/ui/button";

export function SyncDepartmentsButton() {
  const syncDepartments = async () => {
    await fetch("/api/units/sync", { method: "POST" });
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
