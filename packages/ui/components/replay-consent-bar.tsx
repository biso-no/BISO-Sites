"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useCallback, useEffect, useState } from "react";

export type ReplayConsentChoice = "granted" | "denied";

export interface ReplayConsentBarLabels {
  allow: string;
  body: string;
  decline: string;
  privacyHref: string;
  privacyLink: string;
  title: string;
}

export interface ReplayConsentBarProps {
  labels: ReplayConsentBarLabels;
  /** Saves the answer and applies it. Awaited before the bar closes. */
  onChoose: (choice: ReplayConsentChoice) => Promise<void> | void;
  /** The visitor's stored answer; the bar only shows for "unknown". */
  readConsent: () => ReplayConsentChoice | "unknown";
}

/** Fired by "Privacy settings" links to bring the bar back after a choice. */
export const REPLAY_CONSENT_OPEN_EVENT = "biso:replay-consent:open";

export function openReplayConsentSettings(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(REPLAY_CONSENT_OPEN_EVENT));
}

/**
 * Asks before session recording starts. Renders nothing on the server and
 * until the effect below has read the cookie, so crawlers and the first
 * client render match. "Allow" and "No thanks" are the same button in the
 * same size: neither is the nudged choice.
 */
export function ReplayConsentBar({
  labels,
  onChoose,
  readConsent,
}: ReplayConsentBarProps) {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (readConsent() === "unknown") {
      setVisible(true);
    }
    const open = () => setVisible(true);
    window.addEventListener(REPLAY_CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(REPLAY_CONSENT_OPEN_EVENT, open);
  }, [readConsent]);

  const choose = useCallback(
    async (choice: ReplayConsentChoice) => {
      setPending(true);
      try {
        await onChoose(choice);
      } catch {
        // The answer could not be saved; keep the bar so they can try again.
        setPending(false);
        return;
      }
      setPending(false);
      setVisible(false);
    },
    [onChoose]
  );

  if (!visible) {
    return null;
  }

  return (
    <section
      aria-label={labels.title}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto max-h-[60vh] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-4 text-foreground shadow-lg">
        <p className="font-semibold text-sm">{labels.title}</p>
        <p className="mt-1 text-muted-foreground text-sm">
          {labels.body}{" "}
          <a
            className="underline underline-offset-4"
            href={labels.privacyHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            {labels.privacyLink}
          </a>
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() => choose("granted")}
            size="sm"
            type="button"
            variant="outline"
          >
            {labels.allow}
          </Button>
          <Button
            className="flex-1"
            disabled={pending}
            onClick={() => choose("denied")}
            size="sm"
            type="button"
            variant="outline"
          >
            {labels.decline}
          </Button>
        </div>
      </div>
    </section>
  );
}
