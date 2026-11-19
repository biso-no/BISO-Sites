import { logServerRequestError } from "@repo/shared/utils/server-error-logging";
import { captureRequestError } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi } from "vitest";

const serverConfigLoaded = vi.hoisted(() => vi.fn());

vi.mock("@repo/shared/utils/server-error-logging", () => ({
  logServerRequestError: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureRequestError: vi.fn(),
}));

vi.mock("./sentry.server.config", () => {
  serverConfigLoaded();
  return {};
});

import { onRequestError, register } from "./instrumentation";

const EXPECTS_CURRENT_NAME = /must be "biso_session_web"/;
const REFUSES_TO_START = /Refusing to start/;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register", () => {
  it("accepts the expected cookie configuration", async () => {
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "biso_session_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", "a_session_biso");

    await expect(register()).resolves.toBeUndefined();
  });

  it("refuses to start when APPWRITE_SESSION_COOKIE is unset", async () => {
    // Unset means cookie-prefs writes `biso_session_web` while the shared
    // createSessionClient reads `a_session_biso` — a silent, total logout.
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    await expect(register()).rejects.toThrow(EXPECTS_CURRENT_NAME);
  });

  it("refuses to start when the cookie is set to Appwrite's own name", async () => {
    // `a_session_biso` is `a_session_<projectId>`; on the shared .biso.no
    // domain the browser replays it to appwrite.biso.no and breaks OAuth.
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "a_session_biso");

    await expect(register()).rejects.toThrow(REFUSES_TO_START);
  });

  it("warns but starts when the legacy fallback is missing", async () => {
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
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    await expect(register()).resolves.toBeUndefined();
  });

  it("loads the Sentry server config on the Node.js runtime without a DSN", async () => {
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "biso_session_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", "a_session_biso");

    await expect(register()).resolves.toBeUndefined();
    expect(serverConfigLoaded).toHaveBeenCalledTimes(1);
  });
});

describe("onRequestError", () => {
  it("logs the error and reports it to Sentry with the same arguments", async () => {
    const error = new Error("boom");
    const request = { path: "/events", method: "GET", headers: {} };
    const context = {
      routerKind: "App Router",
      routePath: "/events",
      routeType: "render",
      renderSource: "react-server-components",
      revalidateReason: undefined,
      renderType: "dynamic",
    } as const;

    await onRequestError(error, request, context);

    expect(logServerRequestError).toHaveBeenCalledWith({
      app: "web",
      context,
      error,
      request,
    });
    expect(captureRequestError).toHaveBeenCalledWith(error, request, context);
  });
});
