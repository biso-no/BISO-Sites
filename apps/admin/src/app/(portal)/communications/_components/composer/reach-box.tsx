"use client";

import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useEffect, useState } from "react";
import { getAudienceReach } from "@/app/(portal)/_actions/composer";
import { BRAND, SERIF } from "./ui";

const REACH_DEBOUNCE_MS = 400;
const UNAVAILABLE = "Reach unavailable right now";

export interface ReachRequest {
  audienceType: "broadcast" | "topic" | "users" | "segment";
  audienceValue: string | null;
  campusId: string | null;
  userIds?: string[];
}

interface ReachResult {
  count: number | null;
  sentence: string;
}

interface ReachBoxProps {
  getReach?: (request: ReachRequest) => Promise<ReachResult>;
  request: ReachRequest;
  /** "{title} ({date})" of the linked content, or null when nothing is linked. */
  tappingOpens: string | null;
}

/** What the audience still needs before there is anyone to count. */
function incompleteHint(request: ReachRequest): string | null {
  if (request.audienceType === "users" && !request.userIds?.length) {
    return "Add people to see who it reaches.";
  }
  if (request.audienceType === "segment" && !request.audienceValue) {
    return "Choose a group to see who it reaches.";
  }
  return null;
}

function headline(request: ReachRequest, result: ReachResult): string {
  if (result.count === null) {
    return UNAVAILABLE;
  }
  const isChannel =
    request.audienceType === "broadcast" || request.audienceType === "topic";
  return isChannel ? `About ${result.count} phones` : result.sentence;
}

export function ReachBox({
  getReach = getAudienceReach,
  request,
  tappingOpens,
}: ReachBoxProps) {
  const key = JSON.stringify(request);
  const settled = useDebounce(key, REACH_DEBOUNCE_MS);
  // Each outcome is tied to the request it answers, so a pending request never
  // shows the previous audience's sentence.
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
  const result = current?.result ?? null;
  const failed = current !== null && current.result === null;
  const hint = incompleteHint(request);
  const isChannel =
    request.audienceType === "broadcast" || request.audienceType === "topic";
  // A new request is still being counted while the settled one lags behind.
  const stale = settled !== key;

  let main = "Counting…";
  let sentence: string | null = null;
  if (hint) {
    main = hint;
  } else if (failed) {
    main = UNAVAILABLE;
  } else if (result) {
    main = headline(request, result);
    sentence = isChannel && result.count !== null ? result.sentence : null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        background: BRAND.ink,
        borderRadius: 12,
        color: BRAND.paper,
        fontSize: 13.5,
        lineHeight: 1.45,
        marginTop: 14,
        opacity: stale && !hint ? 0.7 : 1,
        padding: "13px 15px",
        transition: "opacity .15s",
      }}
    >
      <div style={{ fontFamily: SERIF, fontSize: 26 }}>{main}</div>
      {sentence && <div>{sentence}</div>}
      {tappingOpens && (
        <div style={{ marginTop: 2, opacity: 0.75 }}>
          Tapping opens: {tappingOpens}
        </div>
      )}
    </div>
  );
}
