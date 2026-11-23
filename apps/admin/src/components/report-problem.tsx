"use client";

import { openFeedbackForm } from "@repo/observability/browser/feedback";
import { useTranslations } from "next-intl";

/**
 * The "Report a problem" link text and the click handler that opens Sentry's
 * feedback form in the user's language. Admin forms never offer a screenshot.
 */
export function useReportProblem() {
  const t = useTranslations("reportProblem");
  const open = () =>
    openFeedbackForm("admin", {
      addScreenshotButtonLabel: t("addScreenshotButtonLabel"),
      cancelButtonLabel: t("cancelButtonLabel"),
      errorGenericText: t("errorGenericText"),
      formTitle: t("formTitle"),
      isRequiredLabel: t("isRequiredLabel"),
      messageLabel: t("messageLabel"),
      messagePlaceholder: t("messagePlaceholder"),
      removeScreenshotButtonLabel: t("removeScreenshotButtonLabel"),
      submitButtonLabel: t("submitButtonLabel"),
      successMessageText: t("successMessageText"),
    });
  return { label: t("link"), open };
}
