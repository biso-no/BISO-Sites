"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useEffect, useState } from "react";
import { getAudienceReach } from "@/app/(portal)/_actions/composer";
import { phoneCount } from "@/lib/announcements/audience-names";

const REACH_DEBOUNCE_MS = 400;

export const REACH_UNAVAILABLE = "Reach unavailable right now";

export interface ReachRequest {
  audienceType: "broadcast" | "topic" | "users" | "segment";
  audienceValue: string | null;
  campusId: string | null;
  userIds?: string[];
}

export interface ReachResult {
  count: number | null;
  sentence: string;
}

export type GetReach = (request: ReachRequest) => Promise<ReachResult>;

/** What the audience still needs before there is anyone to count. */
export function incompleteHint(request: ReachRequest): string | null {
  if (request.audienceType === "users" && !request.userIds?.length) {
    return "Add people to see who it reaches.";
  }
  if (request.audienceType === "segment" && !request.audienceValue) {
    return "Choose a group to see who it reaches.";
  }
  return null;
}

export function isChannelAudience(request: ReachRequest): boolean {
  return (
    request.audienceType === "broadcast" || request.audienceType === "topic"
  );
}

/** The main line: "About {n} phones" for channels, the sentence otherwise. */
export function reachHeadline(
  request: ReachRequest,
  result: ReachResult
): string {
  if (result.count === null) {
    return REACH_UNAVAILABLE;
  }
  return isChannelAudience(request)
    ? `About ${phoneCount(result.count)}`
    : result.sentence;
}

export interface AudienceReach {
  /** Why there is nothing to count yet, or null. */
  hint: string | null;
  /** The request is still being counted. */
  loading: boolean;
  /** The settled answer, or null while counting, incomplete or failed. */
  result: ReachResult | null;
  /** A newer request is waiting to be counted behind the debounce. */
  stale: boolean;
  /** The count failed or is unknown. */
  unavailable: boolean;
}

/**
 * Counts who an audience reaches, debounced as the audience changes. Each
 * outcome is tied to the request it answers, so a pending request never shows
 * the previous audience's numbers.
 */
export function useAudienceReach(
  request: ReachRequest,
  getReach: GetReach = getAudienceReach
): AudienceReach {
  const key = JSON.stringify(request);
  const settled = useDebounce(key, REACH_DEBOUNCE_MS);
  const [outcome, setOutcome] = useState<{
    key: string;
    result: ReachResult | null;
  } | null>(null);

  useEffect(() => {
    const settledRequest = JSON.parse(settled) as ReachRequest;
    if (incompleteHint(settledRequest)) {
      setOutcome(null);
      return;
    }
    let cancelled = false;
    getReach(settledRequest)
      .then((next) => {
        if (!cancelled) {
          setOutcome({ key: settled, result: next });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOutcome({ key: settled, result: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [settled, getReach]);

  const current = outcome?.key === key ? outcome : null;
  const hint = incompleteHint(request);
  const result = current?.result ?? null;
  const failed =
    (current !== null && current.result === null) || result?.count === null;
  return {
    hint,
    loading: !(hint || current),
    result: failed ? null : result,
    stale: settled !== key,
    unavailable: failed,
  };
}
