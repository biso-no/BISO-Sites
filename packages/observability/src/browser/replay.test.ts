import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RecordingMode = "session" | "buffer" | undefined;

// A client and Replay integration with the SDK's public surface. The fake
// Replay samples into "buffer" when added, as the SDK does with an error
// rate of 1 and an unsampled visit.
const sentry = vi.hoisted(() => {
  const replayIntegration = vi.fn((options: Record<string, unknown>) => {
    let mode: RecordingMode;
    return {
      name: "Replay",
      options,
      afterAllSetup: () => {
        mode = "buffer";
      },
      start: vi.fn(() => {
        mode ??= "session";
      }),
      startBuffering: vi.fn(() => {
        mode ??= "buffer";
      }),
      stop: vi.fn((_options?: { flush?: boolean }) => {
        mode = undefined;
        return Promise.resolve();
      }),
      /** The SDK stopping on its own (time limit, rate limit). */
      expire: () => {
        mode = undefined;
      },
      getRecordingMode: () => mode,
    };
  });
  type FakeReplay = ReturnType<typeof replayIntegration>;

  const makeClient = ({ withDsn = true } = {}) => {
    const options = {
      dsn: withDsn ? "https://k@o1.ingest.de.sentry.io/2" : undefined,
      enabled: withDsn,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    };
    const integrations = new Map<string, FakeReplay>();
    const ratesAtAdd: { session: number; error: number }[] = [];
    const hooks = new Map<string, ((...args: unknown[]) => void)[]>();
    return {
      options,
      integrations,
      ratesAtAdd,
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
      addIntegration: vi.fn((integration: FakeReplay) => {
        ratesAtAdd.push({
          session: options.replaysSessionSampleRate,
          error: options.replaysOnErrorSampleRate,
        });
        integrations.set(integration.name, integration);
        integration.afterAllSetup();
      }),
    };
  };

  return {
    makeClient,
    replayIntegration,
    client: undefined as ReturnType<typeof makeClient> | undefined,
    imports: 0,
    failImport: false,
  };
});

vi.mock("@sentry/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/core")>()),
  getClient: () => sentry.client,
}));

const loadController = () => import("./replay");

const addedReplay = () => {
  const replay = sentry.client?.integrations.get("Replay");
  if (!replay) {
    throw new Error("Replay was not added");
  }
  return replay;
};

beforeEach(() => {
  // A fresh controller (module state) for every test.
  vi.resetModules();
  // Counts loads of the module that carries Replay; a static value import in
  // the controller would load it with the controller, before any consent.
  // Registered per test: `resetModules` keeps a hoisted mock's first result.
  vi.doMock("@sentry/nextjs", () => {
    sentry.imports += 1;
    if (sentry.failImport) {
      throw new Error("chunk failed to load");
    }
    return { replayIntegration: sentry.replayIntegration };
  });
  sentry.replayIntegration.mockClear();
  sentry.client = sentry.makeClient();
  sentry.imports = 0;
  sentry.failImport = false;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("applyReplayConsent without a yes", () => {
  it.each([
    "unknown",
    "denied",
  ] as const)("never loads Replay for %s", async (consent) => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", consent);
    expect(sentry.imports).toBe(0);
    expect(sentry.client?.addIntegration).not.toHaveBeenCalled();
    expect(sentry.client?.options.replaysSessionSampleRate).toBe(0);
    expect(sentry.client?.options.replaysOnErrorSampleRate).toBe(0);
  });
});

describe("applyReplayConsent granted", () => {
  it.each([
    "web",
    "admin",
  ] as const)("loads Replay once for %s with the rates set before it is added", async (app) => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent(app, "granted");
    expect(sentry.imports).toBe(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.client?.ratesAtAdd).toEqual([{ session: 0.25, error: 1 }]);
  });

  it("masks everything, keeps no sticky session and records no network details", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    expect(sentry.replayIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.replayIntegration.mock.calls[0]?.[0]).toStrictEqual({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      maskAttributes: [
        "title",
        "placeholder",
        "aria-label",
        "href",
        "src",
        "srcset",
        "alt",
        "action",
        "formaction",
      ],
      block: ["a[href]", "area[href]", "iframe"],
      stickySession: false,
      networkDetailAllowUrls: [],
      beforeAddRecordingEvent: expect.any(Function),
    });
  });

  it("adds one integration when granted twice", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await applyReplayConsent("web", "granted");
    expect(sentry.replayIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
    expect(addedReplay().start).not.toHaveBeenCalled();
    expect(addedReplay().startBuffering).not.toHaveBeenCalled();
  });

  it("adds one integration when two grants race the load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { applyReplayConsent } = await loadController();
    await Promise.all([
      applyReplayConsent("web", "granted"),
      applyReplayConsent("web", "granted"),
    ]);
    expect(sentry.replayIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("adds nothing when the yes is withdrawn while Replay loads", async () => {
    const { applyReplayConsent } = await loadController();
    await Promise.all([
      applyReplayConsent("web", "granted"),
      applyReplayConsent("web", "denied"),
    ]);
    expect(sentry.client?.addIntegration).not.toHaveBeenCalled();
    expect(sentry.client?.options.replaysSessionSampleRate).toBe(0);
  });
});

describe("applyReplayConsent withdrawn and given again", () => {
  it("stops a running recording without sending what is pending", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await applyReplayConsent("web", "denied");
    expect(addedReplay().stop).toHaveBeenCalledWith({ flush: false });
    expect(addedReplay().getRecordingMode()).toBeUndefined();
  });

  it("stops on a cleared answer too", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("admin", "granted");
    await applyReplayConsent("admin", "unknown");
    expect(addedReplay().stop).toHaveBeenCalledWith({ flush: false });
  });

  // A resumed visit is sampled like a new one: the SDK's start() alone would
  // record every visit in full.
  it("buffers for errors when the visit falls outside the 25%", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await applyReplayConsent("web", "denied");
    await applyReplayConsent("web", "granted");
    expect(addedReplay().start).not.toHaveBeenCalled();
    expect(addedReplay().startBuffering).toHaveBeenCalledTimes(1);
    expect(addedReplay().getRecordingMode()).toBe("buffer");
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
  });

  it("records the whole visit when it falls inside the 25%", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.24);
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await applyReplayConsent("web", "denied");
    await applyReplayConsent("web", "granted");
    expect(addedReplay().start).toHaveBeenCalledTimes(1);
    expect(addedReplay().startBuffering).not.toHaveBeenCalled();
    expect(addedReplay().getRecordingMode()).toBe("session");
  });
});

describe("applyReplayConsent without a working Sentry", () => {
  it("does nothing without a client", async () => {
    sentry.client = undefined;
    const { applyReplayConsent } = await loadController();
    await expect(applyReplayConsent("web", "granted")).resolves.toBeUndefined();
    expect(sentry.imports).toBe(0);
  });

  it("does nothing when the client has no DSN", async () => {
    sentry.client = sentry.makeClient({ withDsn: false });
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    expect(sentry.imports).toBe(0);
    expect(sentry.client.addIntegration).not.toHaveBeenCalled();
  });

  it("resolves and warns once when Replay fails to load", async () => {
    sentry.failImport = true;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { applyReplayConsent } = await loadController();
    await expect(applyReplayConsent("web", "granted")).resolves.toBeUndefined();
    await expect(applyReplayConsent("web", "granted")).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(sentry.client?.addIntegration).not.toHaveBeenCalled();
  });
});

/** Puts the test on a page of biso.no (or admin.biso.no). */
const visit = (path: string, origin = "https://biso.no") => {
  vi.stubGlobal("location", new URL(path, origin));
};

/** Lets the controller's deferred check and any Replay load run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

/** What Sentry's history instrumentation reports before the address changes. */
const navigate = async (to: string) => {
  const { triggerHandlers } = await import("@sentry/core");
  triggerHandlers("history", { from: String(globalThis.location), to });
};

describe("isReplayDenied", () => {
  it.each([
    ["web", "https://biso.no/auth/verify?userId=u1&secret=s1"],
    ["web", "/auth/login?redirectTo=/profile"],
    ["web", "/fs/approve/tok123?intent=approve"],
    ["web", "/recruitment/book/tok123"],
    ["web", "/shop/order/order1?success=true"],
    ["web", "/events?q=Kari"],
    ["web", "/AUTH/Verify"],
    ["web", "https://biso.no//auth/verify"],
    ["web", "/%61uth/verify"],
    ["admin", "/auth/login?redirectTo=/members"],
    ["admin", "/scan/tok123"],
    ["admin", "/it/users"],
    ["admin", "/it/users/u1"],
    ["admin", "/members?q=Kari"],
    ["admin", "/shop?view=orders&q=kari%40biso.no"],
    ["admin", "/jobs/applications?search=Kari"],
  ] as const)("does not record %s %s", async (app, href) => {
    const { isReplayDenied } = await loadController();
    expect(isReplayDenied(app, href)).toBe(true);
  });

  it.each([
    ["web", "/"],
    ["web", "/authors"],
    ["web", "/fs/new"],
    ["web", "/shop/cart?cancelled=true"],
    ["web", "/events?q="],
    ["web", "/events?campus=oslo"],
    ["web", "/it/users"],
    ["admin", "/"],
    ["admin", "/members"],
    ["admin", "/jobs/j1/applications?candidate=a1"],
    ["admin", "/scanner"],
  ] as const)("records %s %s", async (app, href) => {
    const { isReplayDenied } = await loadController();
    expect(isReplayDenied(app, href)).toBe(false);
  });

  it("keeps at least the agreed pages out", async () => {
    const { REPLAY_DENYLIST } = await loadController();
    expect(REPLAY_DENYLIST.web.paths).toEqual(
      expect.arrayContaining(["/auth", "/fs/approve", "/shop/order"])
    );
    expect(REPLAY_DENYLIST.admin.paths).toEqual(
      expect.arrayContaining(["/auth", "/it/users"])
    );
  });
});

describe("applyReplayConsent on a page that is not recorded", () => {
  it.each([
    ["web", "/auth/verify?userId=u1&secret=s1"],
    ["admin", "/it/users?q=Kari"],
  ] as const)("never loads Replay for %s %s, even with a yes", async (app, path) => {
    visit(path);
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent(app, "granted");
    await settle();
    expect(sentry.imports).toBe(0);
    expect(sentry.client?.addIntegration).not.toHaveBeenCalled();
  });

  it("adds Replay once the visitor moves on to a page that may be recorded", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    visit("/auth/login");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await navigate("https://biso.no/events");
    visit("/events");
    await settle();
    expect(sentry.imports).toBe(1);
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
  });

  it("stops a running replay on a yes given on such a page", async () => {
    visit("/");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    visit("/auth/login");
    await applyReplayConsent("web", "granted");
    expect(addedReplay().stop).toHaveBeenCalledWith({ flush: false });
  });
});

describe("navigation", () => {
  it("stops before the address changes to a page that is not recorded", async () => {
    visit("/");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    expect(addedReplay().getRecordingMode()).toBe("buffer");
    await navigate("https://biso.no/auth/verify?userId=u1&secret=s1");
    // Synchronously, before any timer: Replay's own handler runs next.
    expect(addedReplay().stop).toHaveBeenCalledWith({ flush: false });
    expect(addedReplay().getRecordingMode()).toBeUndefined();
  });

  it("stays stopped there and starts again, sampled, after leaving", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.24);
    visit("/");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await navigate("https://biso.no/auth/login");
    visit("/auth/login");
    await settle();
    expect(addedReplay().getRecordingMode()).toBeUndefined();
    await navigate("https://biso.no/news");
    visit("/news");
    await settle();
    expect(addedReplay().start).toHaveBeenCalledTimes(1);
    expect(addedReplay().getRecordingMode()).toBe("session");
    expect(sentry.client?.addIntegration).toHaveBeenCalledTimes(1);
  });

  it("buffers for errors after leaving when the visit falls outside the 25%", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.25);
    visit("/members", "https://admin.biso.no");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("admin", "granted");
    await navigate("https://admin.biso.no/members?q=Kari");
    visit("/members?q=Kari", "https://admin.biso.no");
    await settle();
    expect(addedReplay().getRecordingMode()).toBeUndefined();
    await navigate("https://admin.biso.no/members");
    visit("/members", "https://admin.biso.no");
    await settle();
    expect(addedReplay().startBuffering).toHaveBeenCalledTimes(1);
    expect(addedReplay().start).not.toHaveBeenCalled();
  });

  it("does not start without a yes after leaving", async () => {
    visit("/auth/login");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "denied");
    await navigate("https://biso.no/");
    visit("/");
    await settle();
    expect(sentry.imports).toBe(0);
  });

  it("leaves a replay the SDK stopped itself alone", async () => {
    visit("/");
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    addedReplay().expire();
    await navigate("https://biso.no/events");
    visit("/events");
    await settle();
    expect(addedReplay().start).not.toHaveBeenCalled();
    expect(addedReplay().startBuffering).not.toHaveBeenCalled();
  });

  it("stops when the router starts loading such a page, and waits for the address", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    visit("/");
    const { applyReplayConsent, stopReplayBeforeNavigation } =
      await loadController();
    await applyReplayConsent("web", "granted");
    stopReplayBeforeNavigation("web", "/fs/approve/tok123");
    expect(addedReplay().stop).toHaveBeenCalledWith({ flush: false });
    // The old page is still shown while the new one loads.
    await settle();
    expect(addedReplay().getRecordingMode()).toBeUndefined();
    await navigate("https://biso.no/fs/approve/tok123");
    visit("/fs/approve/tok123");
    await settle();
    expect(addedReplay().getRecordingMode()).toBeUndefined();
    await navigate("https://biso.no/");
    visit("/");
    await settle();
    expect(addedReplay().getRecordingMode()).toBe("buffer");
  });

  it("does not load Replay that was still loading when such a page opened", async () => {
    visit("/");
    const { applyReplayConsent, stopReplayBeforeNavigation } =
      await loadController();
    const granting = applyReplayConsent("web", "granted");
    stopReplayBeforeNavigation("web", "/auth/login");
    await granting;
    expect(sentry.client?.addIntegration).not.toHaveBeenCalled();
  });
});

describe("addresses in what Replay sends", () => {
  interface RecordingEvent {
    data: object;
    timestamp: number;
    type: number;
  }
  type RecordingHook = (event: RecordingEvent) => RecordingEvent;

  const recordingHook = async (): Promise<RecordingHook> => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    const options = sentry.replayIntegration.mock.calls[0]?.[0] as {
      beforeAddRecordingEvent: RecordingHook;
    };
    return options.beforeAddRecordingEvent;
  };

  const span = (op: string, description: string, data?: object) => ({
    type: 5,
    timestamp: 1,
    data: {
      tag: "performanceSpan",
      payload: { op, description, startTimestamp: 1, endTimestamp: 2, data },
    },
  });

  it("drops the query and fragment of every replay event URL", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    const event = {
      type: "replay_event",
      urls: ["https://biso.no/x?q=Kari#h", "/auth/verify?secret=s1"],
      request: { url: "https://biso.no/x?q=Kari" },
    };
    sentry.client?.emit("preprocessEvent", event, {});
    expect(event.urls).toEqual(["https://biso.no/x", "/auth/verify"]);
    expect(event.request.url).toBe("https://biso.no/x");
  });

  it("leaves other events to beforeSend", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    const event = { request: { url: "https://biso.no/x?a=1" } };
    sentry.client?.emit("preprocessEvent", event, {});
    expect(event.request.url).toBe("https://biso.no/x?a=1");
  });

  it("registers the replay event hook once across withdrawals", async () => {
    const { applyReplayConsent } = await loadController();
    await applyReplayConsent("web", "granted");
    await applyReplayConsent("web", "denied");
    await applyReplayConsent("web", "granted");
    expect(sentry.client?.hooks.get("preprocessEvent")).toHaveLength(1);
  });

  it.each([
    [
      "navigation.push",
      "https://biso.no/members?q=Kari#top",
      "https://biso.no/members",
    ],
    [
      "navigation.navigate",
      "https://biso.no/auth/verify?userId=u1&secret=s1",
      "https://biso.no/auth/verify",
    ],
    ["resource.fetch", "/api/users?q=Kari&_rsc=1", "/api/users"],
    [
      "resource.img",
      "https://biso.no/_next/image?url=x",
      "https://biso.no/_next/image",
    ],
  ])("drops the query of a %s span description", async (op, description, expected) => {
    const hook = await recordingHook();
    const result = hook(span(op, description)) as ReturnType<typeof span>;
    expect(result.data.payload.description).toBe(expected);
  });

  it("drops the query of the page a navigation left", async () => {
    const hook = await recordingHook();
    const result = hook(
      span("navigation.push", "/news", { previous: "/members?q=Kari" })
    ) as ReturnType<typeof span>;
    expect(result.data.payload.data).toEqual({ previous: "/members" });
  });

  it("leaves other span descriptions alone", async () => {
    const hook = await recordingHook();
    const result = hook(
      span("largest-contentful-paint", "body > div#main")
    ) as ReturnType<typeof span>;
    expect(result.data.payload.description).toBe("body > div#main");
  });

  it("drops the query of a page address in Replay's own breadcrumbs", async () => {
    const hook = await recordingHook();
    const event = {
      type: 5,
      timestamp: 1,
      data: {
        tag: "breadcrumb",
        payload: {
          category: "ui.slowClickDetected",
          data: { url: "https://admin.biso.no/it/users?q=Kari", route: "/x" },
        },
      },
    };
    hook(event);
    expect(event.data.payload.data.url).toBe("https://admin.biso.no/it/users");
  });
});

describe("readConsentFromDocument", () => {
  it("reads the cookie the browser holds", async () => {
    vi.stubGlobal("document", {
      cookie: "a=1; biso_replay_consent=v1%3Agranted",
    });
    const { readConsentFromDocument } = await loadController();
    expect(readConsentFromDocument()).toBe("granted");
  });

  // A sandboxed frame throws on `document.cookie`; client init must go on.
  it("is no answer when the cookie can't be read", async () => {
    vi.stubGlobal("document", {
      get cookie(): string {
        throw new Error("SecurityError");
      },
    });
    const { readConsentFromDocument } = await loadController();
    expect(readConsentFromDocument()).toBe("unknown");
  });

  it("is no answer outside a browser", async () => {
    const { readConsentFromDocument } = await loadController();
    expect(readConsentFromDocument()).toBe("unknown");
  });
});
