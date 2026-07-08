import { afterEach, describe, expect, it, vi } from "vitest";

import { logServerRequestError } from "./server-error-logging";

describe("logServerRequestError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured request errors with sensitive headers redacted", () => {
    const error = new Error("database unavailable") as Error & {
      digest?: string;
    };
    error.digest = "NEXT_DIGEST_123";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logServerRequestError({
      app: "web",
      context: {
        routePath: "/app/shop/page",
        routeType: "render",
        routerKind: "App Router",
      },
      error,
      request: {
        headers: {
          authorization: "Bearer super-secret",
          cookie: "a_session=secret",
          "x-request-id": "req-123",
        },
        method: "GET",
        path: "/shop",
      },
    });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "[request-error]",
      expect.objectContaining({
        app: "web",
        context: expect.objectContaining({
          routePath: "/app/shop/page",
          routeType: "render",
        }),
        error: expect.objectContaining({
          digest: "NEXT_DIGEST_123",
          message: "database unavailable",
          name: "Error",
        }),
        request: expect.objectContaining({
          headers: expect.objectContaining({
            authorization: "[redacted]",
            cookie: "[redacted]",
            "x-request-id": "req-123",
          }),
          method: "GET",
          path: "/shop",
        }),
      })
    );
  });
});
