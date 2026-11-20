"use client";

import {
  chooseReplayConsent,
  readConsentFromDocument,
} from "@repo/observability/browser/replay";
import {
  ReplayConsentBar,
  type ReplayConsentChoice,
} from "@repo/ui/components/replay-consent-bar";
import { useTranslations } from "next-intl";
import { setReplayConsent } from "@/lib/actions/replay-consent";

const PRIVACY_URL = "https://biso.no/privacy";

// A "no" stops recording before it is saved; see `chooseReplayConsent`.
const choose = (choice: ReplayConsentChoice) =>
  chooseReplayConsent("admin", choice, setReplayConsent);

/**
 * Asks before session recording starts; see `ReplayConsentBar`. Mounted by
 * each route group's layout, which knows where its page scrolls: the portal
 * and the page editor scroll inside their own full-height shell and pass
 * `reserveBodySpace={false}` (the portal pads its scroller with the bar's
 * height variable); sign-in and the profile scroll the body, which is padded
 * so the bar never covers the end of the page.
 */
export function ReplayConsent({
  reserveBodySpace = true,
}: {
  reserveBodySpace?: boolean;
}) {
  const t = useTranslations("replayConsent");
  return (
    <ReplayConsentBar
      labels={{
        allow: t("allow"),
        body: t("body"),
        decline: t("decline"),
        privacyHref: PRIVACY_URL,
        privacyLink: t("privacyLink"),
        title: t("title"),
      }}
      onChoose={choose}
      readConsent={readConsentFromDocument}
      reserveBodySpace={reserveBodySpace}
    />
  );
}
