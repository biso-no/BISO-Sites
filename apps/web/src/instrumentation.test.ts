import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@repo/shared/utils/server-error-logging", () => ({
  logServerRequestError: vi.fn(),
}));

import { register } from "./instrumentation";

const EXPECTS_CURRENT_NAME = /must be "a_session_biso_web"/;
const REFUSES_TO_START = /Refusing to start/;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("register", () => {
  it("accepts the expected cookie configuration", () => {
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "a_session_biso_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", "a_session_biso");

    expect(() => register()).not.toThrow();
  });

  it("refuses to start when APPWRITE_SESSION_COOKIE is unset", () => {
    // Unset means cookie-prefs writes `a_session_biso_web` while the shared
    // createSessionClient reads `a_session_biso` — a silent, total logout.
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    expect(() => register()).toThrow(EXPECTS_CURRENT_NAME);
  });

  it("refuses to start when the cookie is set to Appwrite's own name", () => {
    // `a_session_biso` is `a_session_<projectId>`; on the shared .biso.no
    // domain the browser replays it to appwrite.biso.no and breaks OAuth.
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "a_session_biso");

    expect(() => register()).toThrow(REFUSES_TO_START);
  });

  it("warns but starts when the legacy fallback is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      // silence expected warning
    });
    vi.stubEnv("NEXT_PHASE", "");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", "a_session_biso_web");
    vi.stubEnv("APPWRITE_SESSION_COOKIE_FALLBACK", undefined);

    expect(() => register()).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it("skips validation during next build, where env is absent", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("APPWRITE_SESSION_COOKIE", undefined);

    expect(() => register()).not.toThrow();
  });
});
