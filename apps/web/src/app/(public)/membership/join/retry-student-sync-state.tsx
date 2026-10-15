"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";
import { BiSyncFailedState } from "./gate-states";

/**
 * Signed in with BI, but the student number never reached the profile:
 * the sync failed, the BI account is already linked to another BISO
 * account, or it is not a student account with an s-number. Offering
 * "Sign in with BI" here would loop, so this retries the sync instead and
 * points to support.
 */
export function RetryStudentSyncState() {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();

  const retry = () => {
    startRetry(async () => {
      await syncBiStudentIdentity();
      router.refresh();
    });
  };

  return <BiSyncFailedState isRetrying={isRetrying} onRetry={retry} />;
}
