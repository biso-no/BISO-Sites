/**
 * The "Report a problem" form, opened from our own links (no floating
 * button). Browser-only. `@sentry/nextjs` is imported for types only, so the
 * feedback code loads through the dynamic import below, on the first click.
 */
import { type Client, type ClientOptions, getClient } from "@sentry/core";
import type { feedbackIntegration } from "@sentry/nextjs";

type FeedbackIntegration = ReturnType<typeof feedbackIntegration>;

export type FeedbackApp = "web" | "admin";

/** The texts of the form, in the visitor's language. */
export interface FeedbackLabels {
  addScreenshotButtonLabel: string;
  cancelButtonLabel: string;
  errorGenericText: string;
  formTitle: string;
  isRequiredLabel: string;
  messageLabel: string;
  messagePlaceholder: string;
  removeScreenshotButtonLabel: string;
  submitButtonLabel: string;
  successMessageText: string;
}

/** The name `getFeedback()` looks up. */
const FEEDBACK_INTEGRATION_NAME = "Feedback";

let hasWarned = false;

/** A client that sends nothing (no DSN) has nowhere to send a report. */
const sendingClient = (): Client<ClientOptions> | undefined => {
  const client = getClient();
  if (!client?.getDsn() || client.getOptions().enabled === false) {
    return;
  }
  return client;
};

/**
 * Opens the form, adding the integration on first use. Resolves without doing
 * anything when Sentry isn't set up, and never throws.
 */
export async function openFeedbackForm(
  app: FeedbackApp,
  labels: FeedbackLabels
): Promise<void> {
  try {
    const client = sendingClient();
    if (!client) {
      return;
    }
    const sentry = await import("@sentry/nextjs");
    // The SDK may throw when the same integration is added twice.
    let feedback = client.getIntegrationByName<FeedbackIntegration>(
      FEEDBACK_INTEGRATION_NAME
    );
    if (!feedback) {
      client.addIntegration(
        sentry.feedbackIntegration({
          autoInject: false,
          showName: false,
          showEmail: false,
          showBranding: false,
          colorScheme: "system",
          // Staff screens show other people's data.
          enableScreenshot: app === "web",
          tags: { app },
          ...labels,
        })
      );
      feedback = sentry.getFeedback();
    }
    const form = await feedback?.createForm();
    form?.appendToDom();
    form?.open();
  } catch (error) {
    if (!hasWarned) {
      hasWarned = true;
      console.warn("[sentry] the feedback form could not be opened", error);
    }
  }
}
