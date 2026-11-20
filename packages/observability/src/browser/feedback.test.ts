import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedbackLabels } from "./feedback";

const sentry = vi.hoisted(() => {
  const makeForm = () => {
    const messageField = { focus: vi.fn() };
    return {
      appendToDom: vi.fn(),
      open: vi.fn(),
      removeFromDom: vi.fn(),
      messageField,
      el: {
        querySelector: vi.fn((selector: string) =>
          selector === "textarea" ? messageField : null
        ),
      },
    };
  };
  type FakeForm = ReturnType<typeof makeForm>;
  const state = { forms: [] as FakeForm[] };
  const feedbackIntegration = vi.fn((options: Record<string, unknown>) => ({
    name: "Feedback",
    options,
    createForm: vi.fn((_overrides?: Record<string, unknown>) => {
      const form = makeForm();
      state.forms.push(form);
      return Promise.resolve(form);
    }),
  }));
  type FakeFeedback = ReturnType<typeof feedbackIntegration>;

  const makeClient = ({ withDsn = true } = {}) => {
    const options = {
      dsn: withDsn ? "https://k@o1.ingest.de.sentry.io/2" : undefined,
      enabled: withDsn,
    };
    const integrations = new Map<string, FakeFeedback>();
    const hooks = new Map<string, ((...args: unknown[]) => void)[]>();
    return {
      integrations,
      hooks,
      on: vi.fn((hook: string, callback: (...args: unknown[]) => void) => {
        hooks.set(hook, [...(hooks.get(hook) ?? []), callback]);
        return () => undefined;
      }),
      emit: (hook: string, ...args: unknown[]) => {
        for (const callback of hooks.get(hook) ?? []) {
          callback(...args);
        }
      },
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
    state,
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
  sentry.state.forms = [];
  sentry.client = sentry.makeClient();
  sentry.imports = 0;
  sentry.failImport = false;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("openFeedbackForm", () => {
  it("adds the integration once across two opens and opens a form each time", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    await openFeedbackForm("web", LABELS);
    expect(sentry.feedbackIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.state.forms).toHaveLength(2);
    for (const form of sentry.state.forms) {
      expect(form.appendToDom).toHaveBeenCalledTimes(1);
      expect(form.open).toHaveBeenCalledTimes(1);
    }
  });

  it("passes the current labels on every open, so a language switch shows", async () => {
    const { openFeedbackForm } = await loadFeedback();
    const norwegian = { ...LABELS, formTitle: "Rapporter et problem" };
    await openFeedbackForm("web", LABELS);
    await openFeedbackForm("web", norwegian);
    const createForm = sentry.client?.integrations.get("Feedback")?.createForm;
    expect(createForm?.mock.calls[0]?.[0]).toMatchObject(LABELS);
    expect(createForm?.mock.calls[1]?.[0]).toMatchObject(norwegian);
  });

  it("removes the previous dialog when a new one opens", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    await openFeedbackForm("web", LABELS);
    expect(sentry.state.forms[0]?.removeFromDom).toHaveBeenCalledTimes(1);
    expect(sentry.state.forms[1]?.removeFromDom).not.toHaveBeenCalled();
  });

  it.each([
    "onFormClose",
    "onFormSubmitted",
  ] as const)("removes the dialog from the page on %s", async (hook) => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    const overrides = sentry.client?.integrations.get("Feedback")?.createForm
      .mock.calls[0]?.[0] as Record<string, () => void>;
    overrides[hook]?.();
    overrides[hook]?.();
    expect(sentry.state.forms[0]?.removeFromDom).toHaveBeenCalledTimes(1);
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
    expect(sentry.state.forms).toHaveLength(0);
  });

  it("opens one form when clicked twice while loading", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await Promise.all([
      openFeedbackForm("web", LABELS),
      openFeedbackForm("web", LABELS),
    ]);
    expect(sentry.imports).toBe(1);
    expect(sentry.state.forms).toHaveLength(1);
    expect(sentry.state.forms[0]?.open).toHaveBeenCalledTimes(1);
  });

  it("opens again once the first open has finished", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    await openFeedbackForm("web", LABELS);
    expect(sentry.state.forms).toHaveLength(2);
  });

  it("puts focus in the message field, and again after a closing menu", async () => {
    vi.useFakeTimers();
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("web", LABELS);
    const form = sentry.state.forms[0];
    expect(form?.el.querySelector).toHaveBeenCalledWith("textarea");
    expect(form?.messageField.focus).toHaveBeenCalledTimes(1);
    expect(
      form?.messageField.focus.mock.invocationCallOrder[0]
    ).toBeGreaterThan(
      form?.open.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    vi.runAllTimers();
    expect(form?.messageField.focus).toHaveBeenCalledTimes(2);
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

describe("feedback scrubbing", () => {
  const feedbackEvent = () => ({
    type: "feedback" as const,
    level: "info" as const,
    contexts: {
      feedback: {
        message:
          "Refund to 1234 56 78901 please, or mail kari.nordmann@biso.no. See https://admin.biso.no/it/users?q=Kari",
        url: "https://admin.biso.no/it/users?q=Kari",
        source: "widget",
        replay_id: "r1",
      },
    },
    request: { url: "https://admin.biso.no/it/users?q=Kari" },
    tags: { app: "admin", url: "https://admin.biso.no/it/users?q=Kari" },
    user: { id: "u1", email: "kari.nordmann@biso.no" },
  });

  it("registers once, before the integration is added", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("admin", LABELS);
    await openFeedbackForm("admin", LABELS);
    expect(sentry.client?.hooks.get("beforeSendFeedback")).toHaveLength(1);
    expect(sentry.client?.on.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.client?.addIntegration.mock.invocationCallOrder[0] ?? 0
    );
  });

  it("scrubs the page address, the message and the user in place", async () => {
    const { openFeedbackForm } = await loadFeedback();
    await openFeedbackForm("admin", LABELS);
    const event = feedbackEvent();
    sentry.client?.emit("beforeSendFeedback", event, {});
    expect(event.contexts.feedback.url).toBe("https://admin.biso.no/it/users");
    expect(event.contexts.feedback.message).toBe(
      "Refund to [redacted] please, or mail [redacted]. See https://admin.biso.no/it/users"
    );
    expect(event.request.url).toBe("https://admin.biso.no/it/users");
    expect(event.tags).toEqual({
      app: "admin",
      url: "https://admin.biso.no/it/users",
    });
    expect(event.user).toEqual({ id: "u1" });
    // What identifies the report stays.
    expect(event.type).toBe("feedback");
    expect(event.contexts.feedback.source).toBe("widget");
    expect(event.contexts.feedback.replay_id).toBe("r1");
  });
});
