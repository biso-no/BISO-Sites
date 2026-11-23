import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
  logServerRequestError: vi.fn(),
  serverConfigLoaded: vi.fn(),
  serverConfigThrows: false,
}));

vi.mock("@repo/shared/utils/server-error-logging", () => ({
  logServerRequestError: mocks.logServerRequestError,
}));

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: mocks.captureRequestError,
}));

const mockServerConfig = () => {
  mocks.serverConfigLoaded();
  if (mocks.serverConfigThrows) {
    throw new Error("Cannot find module '@sentry/bun'");
  }
  return {};
};

const EXPECTS_CURRENT_NAME = /must be "biso_session_web"/;
const REFUSES_TO_START = /Refusing to start/;

// A fresh module per test: `register()` keeps whether Sentry loaded in
// module state, and the mocked server config must load (or throw) again.
const loadInstrumentation = () => import("./instrumentation");

const stubValidStartup = (runtime: string | undefined) => {
  vi.stubEnv("NEXT_PHASE", "");
  vi.stubEnv("NEXT_RUNTIME", runtime);
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
  vi.stubEnv("APPWRITE_SESSION_COOKIE", "biso_session_web");
  vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", "a_session_biso");
};

const requestError = () => ({
  error: new Error("boom"),
  request: { path: "/events", method: "GET", headers: {} },
  context: {
    routerKind: "App Router",
    routePath: "/events",
    routeType: "render",
    renderSource: "react-server-components",
    revalidateReason: undefined,
    renderType: "dynamic",
  } as const,
});

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.serverConfigThrows = false;
  // Registered per test (not hoisted) so the factory runs again each time.
  vi.doMock("./sentry.server.config", mockServerConfig);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register", () => {
  it("accepts the expected cookie configuration", async () => {
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "biso_session_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", "a_session_biso");

    await expect(register()).resolves.toBeUndefined();
  });

  it("refuses to start when APPWRITE_SESSION_COOKIE is unset", async () => {
    // Unset means cookie-prefs writes `biso_session_web` while the shared
    // createSessionClient reads `a_session_biso` — a silent, total logout.
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    await expect(register()).rejects.toThrow(EXPECTS_CURRENT_NAME);
  });

  it("refuses to start when the cookie is set to Appwrite's own name", async () => {
    // `a_session_biso` is `a_session_<projectId>`; on the shared .biso.no
    // domain the browser replays it to appwrite.biso.no and breaks OAuth.
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "a_session_biso");

    await expect(register()).rejects.toThrow(REFUSES_TO_START);
  });

  it("warns but starts when the legacy fallback is missing", async () => {
    const { register } = await loadInstrumentation();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // silence expected warning
    });
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "biso_session_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", undefined);

    await expect(register()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("skips validation during next build, where env is absent", async () => {
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    await expect(register()).resolves.toBeUndefined();
  });

  it("loads the Sentry server config on the Node.js runtime without a DSN", async () => {
    const { register } = await loadInstrumentation();
    stubValidStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(mocks.serverConfigLoaded).toHaveBeenCalledTimes(1);
  });

  it("does not load the Sentry server config on other runtimes", async () => {
    const { register } = await loadInstrumentation();
    stubValidStartup("edge");

    await expect(register()).resolves.toBeUndefined();
    expect(mocks.serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("starts without Sentry when a Sentry module fails to load", async () => {
    const { onRequestError, register } = await loadInstrumentation();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // silence expected error
    });
    mocks.serverConfigThrows = true;
    stubValidStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[web] Sentry failed to load; running without it",
      expect.any(Error)
    );

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(mocks.logServerRequestError).toHaveBeenCalledWith({
      app: "web",
      context,
      error,
      request,
    });
    expect(mocks.captureRequestError).not.toHaveBeenCalled();
  });
});

describe("onRequestError", () => {
  it("logs the error and reports it to Sentry with the same arguments", async () => {
    const { onRequestError, register } = await loadInstrumentation();
    stubValidStartup("nodejs");
    await register();

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(mocks.logServerRequestError).toHaveBeenCalledWith({
      app: "web",
      context,
      error,
      request,
    });
    expect(mocks.captureRequestError).toHaveBeenCalledWith(
      error,
      request,
      context
    );
  });
});
