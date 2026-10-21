"use client";

import { getAudienceReach } from "@/app/(portal)/_actions/composer";
import {
  type GetReach,
  isChannelAudience,
  REACH_UNAVAILABLE,
  type ReachRequest,
  reachHeadline,
  useAudienceReach,
} from "./use-audience-reach";
import { BRAND, SERIF } from "./ui";

export type { ReachRequest } from "./use-audience-reach";

interface ReachBoxProps {
  getReach?: GetReach;
  request: ReachRequest;
  /** "{title} ({date})" of the linked content, or null when nothing is linked. */
  tappingOpens: string | null;
}

export function ReachBox({
  getReach = getAudienceReach,
  request,
  tappingOpens,
}: ReachBoxProps) {
  const reach = useAudienceReach(request, getReach);

  let main = "Counting…";
  let sentence: string | null = null;
  if (reach.hint) {
    main = reach.hint;
  } else if (reach.unavailable) {
    main = REACH_UNAVAILABLE;
  } else if (reach.result) {
    main = reachHeadline(request, reach.result);
    sentence = isChannelAudience(request) ? reach.result.sentence : null;
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
        opacity: reach.stale && !reach.hint ? 0.7 : 1,
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
