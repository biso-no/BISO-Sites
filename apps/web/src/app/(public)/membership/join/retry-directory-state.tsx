"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";
import { NeedsDirectoryRecordState } from "./gate-states";

/**
 * Client wrapper around `NeedsDirectoryRecordState`: the directory lookup
 * that populates `bi_employee_id` can fail transiently (Azure hiccup), so
 * "Try again" re-runs `syncBiStudentIdentity()` and refreshes the page
 * instead of sending the student away.
 */
export function RetryDirectoryState() {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  const retry = () => {
    startRetry(async () => {
      await syncBiStudentIdentity();
      router.refresh();
    });
  };

  return <NeedsDirectoryRecordState isRetrying={isRetrying} onRetry={retry} />;
}
