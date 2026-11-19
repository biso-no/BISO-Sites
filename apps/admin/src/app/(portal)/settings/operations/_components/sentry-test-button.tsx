"use client";

import { useState, useTransition } from "react";
import {
  type SentryTestResultLabels,
  sentryTestMessage,
} from "@/lib/sentry-test-error";
import { STUDIO } from "../../../_components/studio";
import { sendSentryTestError } from "../_actions/sentry-test";

export interface SentryTestLabels extends SentryTestResultLabels {
  button: string;
  failed: string;
  sending: string;
}

export function SentryTestButton({ labels }: { labels: SentryTestLabels }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    startTransition(async () => {
      try {
        setMessage(sentryTestMessage(await sendSentryTestError(), labels));
      } catch {
        setMessage(labels.failed);
      }
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        className="rounded-full px-3 py-1 text-xs disabled:opacity-50"
        disabled={pending}
        onClick={send}
        style={{ border: `0.5px solid ${STUDIO.rule}`, color: STUDIO.ink }}
        type="button"
      >
        {pending ? labels.sending : labels.button}
      </button>
      {message && (
        <span
          aria-live="polite"
          className="text-xs"
          style={{ color: STUDIO.ink3 }}
        >
          {message}
        </span>
      )}
    </div>
  );
}
