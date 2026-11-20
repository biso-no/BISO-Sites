import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackLabels } from "./feedback";

const sentry = vi.hoisted(() => {
  const form = { appendToDom: vi.fn(), open: vi.fn() };
  const feedbackIntegration = vi.fn((options: Record<string, unknown>) => ({
    name: "Feedback",
    options,
    createForm: vi.fn(() => Promise.resolve(form)),
  }));
  type FakeFeedback = ReturnType<typeof feedbackIntegration>;

  const makeClient = ({ withDsn = true } = {}) => {
    const options = {
      dsn: withDsn ? "https://k@o1.ingest.de.sentry.io/2" : undefined,
      enabled: withDsn,
    };
    const integrations = new Map<string, FakeFeedback>();
    return {
      integrations,
      getDsn: () => (options.dsn ? { host: "o1" } : undefined),
      getOptions: () => options,
      getIntegrationByName: (name: string) => integrations.get(name),
      addIntegration: vi.fn((integration: FakeFeedback) => {
        if (integrations.has(integration.name)) {
          throw new Error("duplicate integration");
        }
        integrations.set(integration.name, integration);
      }),
    };
  };

  return {
    form,
    makeClient,
    feedbackIntegration,
    client: undefined as ReturnType<typeof makeClient> | undefined,
    imports: 0,
    failImport: false,
  };
});

vi.mock("@sentry/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/core")>()),
  getClient: () => sentry.client,
}));

const LABELS: FeedbackLabels = {
  formTitle: "Report a problem",
  messageLabel: "What went wrong?",
  messagePlaceholder: "Tell us what you did and what happened.",
  isRequiredLabel: "(required)",
  submitButtonLabel: "Send",
  cancelButtonLabel: "Cancel",
  addScreenshotButtonLabel: "Add a screenshot",
  removeScreenshotButtonLabel: "Remove screenshot",
  successMessageText: "Thanks. We got your report.",
  errorGenericText: "Sending failed. Please try again.",
};

const loadFeedback = () => import("./feedback");

beforeEach(() => {
  vi.resetModules();
  vi.doMock("@sentry/nextjs", () => {
    sentry.imports += 1;
    if (sentry.failImport) {
      throw new Error("chunk failed to load");
    }
    return {
      feedbackIntegration: sentry.feedbackIntegration,
      getFeedback: () => sentry.client?.integrations.get("Feedback"),
    };
  });
  sentry.feedbackIntegration.mockClear();
  sentry.form.appendToDom.mockClear();
  sentry.form.open.mockClear();
  sentry.client = sentry.makeClient();
  sentry.imports = 0;
  sentry.failImport = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openFeedbackForm", () => {
  it("adds the integration once across two opens and opens the form each time", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    await openFeedbackForm("web", LABELS);
    expect(sentry.feedbackIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.form.appendToDom).toHaveBeenCalledTimes(2);
    expect(sentry.form.open).toHaveBeenCalledTimes(2);
  });

  it("sets exactly the agreed options for web, with a screenshot", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    expect(sentry.feedbackIntegration.mock.calls[0]?.[0]).toStrictEqual({
      autoInject: false,
      showName: false,
      showEmail: false,
      showBranding: false,
      colorScheme: "system",
      enableScreenshot: true,
      tags: { app: "web" },
      ...LABELS,
    });
  });

  it("turns the screenshot off for admin", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("admin", LABELS);
    const options = sentry.feedbackIntegration.mock.calls[0]?.[0];
    expect(options?.enableScreenshot).toBe(false);
    expect(options?.tags).toStrictEqual({ app: "admin" });
  });

  it("resolves without loading anything when there is no client", async () => {
    sentry.client = undefined;
    const { openFeedbackForm } = await loadFeedback();
    await expect(openFeedbackForm("web", LABELS)).resolves.toBeUndefined();
    expect(sentry.imports).toBe(0);
  });

  it("does nothing without a DSN", async () => {
    sentry.client = sentry.makeClient({ withDsn: false });
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    expect(sentry.imports).toBe(0);
    expect(sentry.form.open).not.toHaveBeenCalled();
  });

  it("never throws when the load fails, and warns once", async () => {
    sentry.failImport = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { openFeedbackForm } = await loadFeedback();
    await expect(openFeedbackForm("web", LABELS)).resolves.toBeUndefined();
    await expect(openFeedbackForm("web", LABELS)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
