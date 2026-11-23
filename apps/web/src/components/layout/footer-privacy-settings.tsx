"use client";

import { openReplayConsentSettings } from "@repo/ui/components/replay-consent-bar";

/**
 * Reopens the recording question after a choice. A client island because the
 * footer is a Server Component and this needs `onClick`; the label comes in as
 * a prop so the island carries no translation code.
 */
export function FooterPrivacySettings({ label }: { label: string }) {
  return (
    <button
      className="type-body-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:rounded-biso-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      onClick={openReplayConsentSettings}
      type="button"
    >
      {label}
    </button>
  );
}
