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

// A fresh module per test: `register()` keeps whether Sentry loaded in
// module state, and the mocked server config must load (or throw) again.
const loadInstrumentation = () => import("./instrumentation");

const requestError = () => ({
  error: new Error("boom"),
  request: { path: "/api/health", method: "GET", headers: {} },
  context: {
    routerKind: "App Router",
    routePath: "/api/health",
    routeType: "route",
    renderSource: undefined,
    revalidateReason: undefined,
    renderType: undefined,
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
  it("loads the Sentry server config on the Node.js runtime", async () => {
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(mocks.serverConfigLoaded).toHaveBeenCalledTimes(1);
  });

  it("does not load the Sentry server config on other runtimes", async () => {
    const { register } = await loadInstrumentation();
    vi.stubEnv("NEXT_RUNTIME", "edge");

    await expect(register()).resolves.toBeUndefined();
    expect(mocks.serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("starts without Sentry when a Sentry module fails to load", async () => {
    const { onRequestError, register } = await loadInstrumentation();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // silence expected error
    });
    mocks.serverConfigThrows = true;
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[api] Sentry failed to load; running without it",
      expect.any(Error)
    );

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(mocks.logServerRequestError).toHaveBeenCalledWith({
      app: "api",
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
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    await register();

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(mocks.logServerRequestError).toHaveBeenCalledWith({
      app: "api",
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
