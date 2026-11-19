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

import { ADMIN_SESSION_COOKIE } from "./lib/session-cookie";

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

const SESSION_COOKIE_MISMATCH = /APPWRITE_SESSION_COOKIE must be/;

// A fresh module per test: `register()` keeps whether Sentry loaded in module
// state, so each test imports its own copy.
let importCounter = 0;
const loadInstrumentation = async () => {
  importCounter += 1;
  return (await import(
    `./instrumentation?test=${importCounter}`
  )) as typeof import("./instrumentation");
};

const ENV_KEYS = [
  "NEXT_PHASE",
  "NEXT_RUNTIME",
  "NEXT_PUBLIC_SENTRY_DSN",
  "APPWRITE_API_KEY",
  "NEXT_PUBLIC_BASE_URL",
  "NEXT_PUBLIC_APPWRITE_ENDPOINT",
  "NEXT_PUBLIC_APPWRITE_PROJECT",
  "APPWRITE_SESSION_COOKIE",
] as const;
const originalEnv: Record<string, string | undefined> = {};

const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const stubValidStartup = (runtime: string | undefined) => {
  setEnv("NEXT_PHASE", "");
  setEnv("NEXT_RUNTIME", runtime);
  setEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
  setEnv("APPWRITE_API_KEY", "key");
  setEnv("NEXT_PUBLIC_BASE_URL", "http://localhost:3001");
  setEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", "https://example.test/v1");
  setEnv("NEXT_PUBLIC_APPWRITE_PROJECT", "project");
  setEnv("APPWRITE_SESSION_COOKIE", ADMIN_SESSION_COOKIE);
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
  it("refuses to start when the session cookie name is wrong", async () => {
    const { register } = await loadInstrumentation();
    stubValidStartup("nodejs");
    setEnv("APPWRITE_SESSION_COOKIE", "a_session_biso");

    await expect(register()).rejects.toThrow(SESSION_COOKIE_MISMATCH);
    expect(serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("skips validation during next build", async () => {
    const { register } = await loadInstrumentation();
    stubValidStartup("nodejs");
    setEnv("NEXT_PHASE", "phase-production-build");
    setEnv("APPWRITE_SESSION_COOKIE", undefined);

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("does not load the Sentry server config on other runtimes", async () => {
    const { register } = await loadInstrumentation();
    stubValidStartup("edge");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).not.toHaveBeenCalled();
  });

  it("starts without Sentry when a Sentry module fails to load", async () => {
    mockServerConfig(true);
    const { onRequestError, register } = await loadInstrumentation();
    const consoleError = spyOn(console, "error").mockImplementation(() => {
      // silence expected error
    });
    stubValidStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "[admin] Sentry failed to load; running without it",
      expect.any(Error)
    );

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(logServerRequestError).toHaveBeenCalledWith({
      app: "admin",
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
    stubValidStartup("nodejs");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).toHaveBeenCalledTimes(1);
  });
});

describe("onRequestError", () => {
  it("logs the error and reports it to Sentry with the same arguments", async () => {
    mockServerConfig(false);
    const { onRequestError, register } = await loadInstrumentation();
    stubValidStartup("nodejs");
    await register();

    const { error, request, context } = requestError();
    await onRequestError(error, request, context);

    expect(logServerRequestError).toHaveBeenCalledWith({
      app: "admin",
      context,
      error,
      request,
    });
    expect(captureRequestError).toHaveBeenCalledWith(error, request, context);
  });
});
