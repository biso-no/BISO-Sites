"use client";

import type { ReachSummary } from "@repo/shared/big-events/messages/plan";
import { useDebounce } from "@repo/ui/hooks/use-debounce";
import { useEffect, useState } from "react";
import type {
  MessageDraft,
  MessageError,
} from "@/lib/big-events/messages/draft";
import type { MessageSample } from "@/lib/big-events/messages/preview";
import { previewMessage } from "../../../../_actions/big-event-messages";

/** Waits this long after the last change before counting. */
const PREVIEW_DEBOUNCE_MS = 400;

export type PreviewAnswer =
  | {
      kind: "ready";
      reach: ReachSummary;
      samples: MessageSample[];
      warnings: string[];
    }
  | { error: MessageError; kind: "refused" }
  | { kind: "failed" };

export interface MessagePreview {
  /** The latest answer; while `pending`, it is for an earlier draft. */
  answer: PreviewAnswer | null;
  /** Nobody chosen yet, so there is nothing to count. */
  idle: boolean;
  /** The draft as it is now hasn't been counted yet. */
  pending: boolean;
}

/**
 * The reach, samples and warnings for the draft (ruling R23), counted again
 * once it has stayed the same for a moment. Null while nobody is chosen.
 */
export function useMessagePreview(
  bigEventId: string,
  draft: MessageDraft | null
): MessagePreview {
  const key = draft ? JSON.stringify(draft) : null;
  const settled = useDebounce(key, PREVIEW_DEBOUNCE_MS);
  const [latest, setLatest] = useState<{
    answer: PreviewAnswer;
    key: string;
  } | null>(null);

  useEffect(() => {
    if (!settled) {
      return;
    }
    let cancelled = false;
    const answer = (next: PreviewAnswer) => {
      if (!cancelled) {
        setLatest({ answer: next, key: settled });
      }
    };
    previewMessage(bigEventId, JSON.parse(settled) as MessageDraft)
      .then((result) =>
        answer(
          result.ok
            ? {
                kind: "ready",
                reach: result.reach,
                samples: result.samples,
                warnings: result.warnings,
              }
            : { error: result.error, kind: "refused" }
        )
      )
      .catch(() => answer({ kind: "failed" }));
    return () => {
      cancelled = true;
    };
  }, [bigEventId, settled]);

  if (key === null) {
    return { answer: null, idle: true, pending: false };
  }
  return {
    answer: latest?.answer ?? null,
    idle: false,
    pending: latest?.key !== key,
  };
}
