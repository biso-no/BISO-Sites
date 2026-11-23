/**
 * The "Report a problem" form, opened from our own links (no floating
 * button). Browser-only. `@sentry/nextjs` is imported for types only, so the
 * feedback code loads through the dynamic import below, on the first click.
 */
import {
  type Client,
  type ClientOptions,
  type FeedbackEvent,
  getClient,
} from "@sentry/core";
import type { feedbackIntegration } from "@sentry/nextjs";
import { scrubEvent } from "../scrub";

type FeedbackIntegration = ReturnType<typeof feedbackIntegration>;
type FeedbackForm = Awaited<ReturnType<FeedbackIntegration["createForm"]>>;

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

/** The dialog in the page; each open replaces it, so there is only one. */
let currentForm: { removeFromDom: () => void } | undefined;

const removeCurrentForm = (): void => {
  currentForm?.removeFromDom();
  currentForm = undefined;
};

/** The open still in progress, so a double click opens one form. */
let opening: Promise<void> | undefined;

/**
 * Feedback events skip `beforeSend`. `beforeSendFeedback` runs just before
 * one is captured and may change it in place, so it gets the error-report
 * scrubbing there: the page address (`contexts.feedback.url`) without its
 * query, no email addresses or account numbers in the message, the user's
 * id only.
 */
const scrubFeedbackEvent = (feedback: FeedbackEvent): void => {
  const clean = scrubEvent(feedback);
  for (const key of Object.keys(feedback)) {
    Reflect.deleteProperty(feedback, key);
  }
  Object.assign(feedback, clean);
};

/**
 * Puts keyboard focus in the message field. The browser ignores the form's
 * own autofocus while the clicked link still has focus, and a menu that has
 * just closed may hand focus back to its trigger a task later, so this tries
 * again then.
 */
const focusMessageField = (form: FeedbackForm): void => {
  // `@sentry/core` types the dialog's element as `unknown` (no DOM types).
  const dialog = form.el as ParentNode | undefined;
  const focus = () => dialog?.querySelector?.("textarea")?.focus();
  focus();
  setTimeout(focus, 0);
};

/** A client that sends nothing (no DSN) has nowhere to send a report. */
const sendingClient = (): Client<ClientOptions> | undefined => {
  const client = getClient();
  if (!client?.getDsn() || client.getOptions().enabled === false) {
    return;
  }
  return client;
};

async function showForm(
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
      client.on("beforeSendFeedback", scrubFeedbackEvent);
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
    removeCurrentForm();
    // The integration keeps the labels it was added with, so the current ones
    // go in on every open (the visitor may have switched language since).
    const form = await feedback?.createForm({
      ...labels,
      onFormClose: removeCurrentForm,
      // Fires once the thank-you message has been shown.
      onFormSubmitted: removeCurrentForm,
    });
    if (!form) {
      return;
    }
    currentForm = form;
    form.appendToDom();
    form.open();
    focusMessageField(form);
  } catch (error) {
    if (!hasWarned) {
      hasWarned = true;
      console.warn("[sentry] the feedback form could not be opened", error);
    }
  }
}

/**
 * Opens the form, adding the integration on first use. A second click while
 * the first is still loading gets the same open. Resolves without doing
 * anything when Sentry isn't set up, and never throws.
 */
export function openFeedbackForm(
  app: FeedbackApp,
  labels: FeedbackLabels
): Promise<void> {
  opening ??= showForm(app, labels).finally(() => {
    opening = undefined;
  });
  return opening;
}
