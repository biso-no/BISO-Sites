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
    return {
      options,
      integrations,
      ratesAtAdd,
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
      stickySession: false,
      networkDetailAllowUrls: [],
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
