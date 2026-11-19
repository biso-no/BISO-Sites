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

  it("logs no IP addresses, query strings or referer queries", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logServerRequestError({
      app: "web",
      error: new Error("boom"),
      request: {
        headers: {
          "cf-connecting-ip": "84.215.12.34",
          referer: "https://biso.no/x?userId=u1",
          "user-agent": "Mozilla/5.0",
          "X-Forwarded-For": "84.215.12.34, 10.0.0.1",
          "x-real-ip": "84.215.12.34",
        },
        method: "GET",
        path: "/auth/verify?secret=abc&userId=u1#frag",
      },
    });

    const [, logged] = consoleError.mock.calls[0] as [
      string,
      { request: { headers: Record<string, unknown>; path: string } },
    ];
    expect(logged.request.path).toBe("/auth/verify");
    expect(logged.request.headers).toEqual({
      "cf-connecting-ip": "[redacted]",
      referer: "https://biso.no/x",
      "user-agent": "Mozilla/5.0",
      "X-Forwarded-For": "[redacted]",
      "x-real-ip": "[redacted]",
    });
    const text = JSON.stringify(consoleError.mock.calls);
    expect(text).not.toContain("84.215.12.34");
    expect(text).not.toContain("secret");
    expect(text).not.toContain("u1");
  });

  it("keeps the path undefined when the request has none", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    logServerRequestError({ app: "api", error: "boom" });
    const [, logged] = consoleError.mock.calls[0] as [
      string,
      { request: { headers: unknown; path: unknown } },
    ];
    expect(logged.request).toEqual({
      headers: {},
      method: undefined,
      path: undefined,
    });
  });
});
