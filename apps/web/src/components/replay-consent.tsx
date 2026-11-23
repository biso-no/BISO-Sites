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
import { setReplayConsent } from "@/app/actions/replay-consent";

const PRIVACY_URL = "https://biso.no/privacy";

// A "no" stops recording before it is saved; see `chooseReplayConsent`.
const choose = (choice: ReplayConsentChoice) =>
  chooseReplayConsent("web", choice, setReplayConsent);

/** Asks before session recording starts; see `ReplayConsentBar`. */
export function ReplayConsent() {
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
    />
  );
}
