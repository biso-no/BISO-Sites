import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";

const logServerRequestError = mock();
const captureRequestError = mock();
const serverConfigLoaded = mock();

mock.module("@repo/shared/utils/server-error-logging", () => ({
  logServerRequestError,
}));

mock.module("@sentry/nextjs", () => ({ captureRequestError }));

// Bun runs a mock factory when the module is first imported, and again, right
// away, when the mock is re-registered after that. So the "Sentry config is
// not loaded" tests come first, and each later test registers its own factory.
const mockServerConfig = (throws: boolean) =>
  mock.module("./sentry.server.config", () => {
    serverConfigLoaded();
    if (throws) {
      throw new Error("Cannot find module '@sentry/bun'");
    }
    return {};
  });

// A fresh module per test: `register()` keeps whether Sentry loaded in module
// state, so each test imports its own copy.
let importCounter = 0;
const loadInstrumentation = async () => {
  importCounter += 1;
  return (await import(
    `./instrumentation?test=${importCounter}`
  )) as typeof import("./instrumentation");
};

const ENV_KEYS = ["NEXT_PHASE", "NEXT_RUNTIME", "NEXT_PUBLIC_SENTRY_DSN"];
const originalEnv: Record<string, string | undefined> = {};

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const stubStartup = (runtime: string | undefined) => {
  setEnv("NEXT_PHASE", "");
  setEnv("NEXT_RUNTIME", runtime);
  setEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
};

const requestError = () => ({
  error: new Error("boom"),
  request: { path: "/guide", method: "GET", headers: {} },
  context: {
    routerKind: "App Router",
    routePath: "/guide",
    routeType: "render",
    renderSource: "react-server-components",
    revalidateReason: undefined,
    renderType: "dynamic",
  } as const,
});

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
  logServerRequestError.mockClear();
  captureRequestError.mockClear();
  serverConfigLoaded.mockClear();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    setEnv(key, originalEnv[key]);
  }
});

describe("register", () => {
  it("skips Sentry during next build", async () => {
    const { register } = await loadInstrumentation();
    stubStartup("nodejs");
    setEnv("NEXT_PHASE", "phase-production-build");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("does not load the Sentry server config on other runtimes", async () => {
    const { register } = await loadInstrumentation();
    stubStartup("edge");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("starts without Sentry when a Sentry module fails to load", async () => {
    mockServerConfig(true);
    const { onRequestError, register } = await loadInstrumentation();
    const consoleError = spyOn(console, "error").mockImplementation(() => {
      // silence expected error
    });
    stubStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[docs] Sentry failed to load; running without it",
      expect.any(Error)
    );

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(logServerRequestError).toHaveBeenCalledWith({
      app: "docs",
      context,
      error,
      request,
    });
    expect(captureRequestError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("loads the Sentry server config on the Node.js runtime without a DSN", async () => {
    mockServerConfig(false);
    serverConfigLoaded.mockClear();
    const { register } = await loadInstrumentation();
    stubStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).toHaveBeenCalledTimes(1);
  });
});

describe("onRequestError", () => {
  it("logs the error and reports it to Sentry with the same arguments", async () => {
    mockServerConfig(false);
    const { onRequestError, register } = await loadInstrumentation();
    stubStartup("nodejs");
    await register();

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(logServerRequestError).toHaveBeenCalledWith({
      app: "docs",
      context,
      error,
      request,
    });
    expect(captureRequestError).toHaveBeenCalledWith(error, request, context);
  });
});
