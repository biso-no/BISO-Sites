import { createServer, type ServerResponse } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";

const startSpan = vi.fn(
  (_options: unknown, callback: (span: unknown) => unknown) =>
    callback({ setAttribute: vi.fn() })
);
const isEnabled = vi.fn(() => true);

vi.mock("@sentry/core", () => ({ isEnabled, startSpan }));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

interface TestClient {
  call: (method: string, url: URL) => Promise<unknown>;
  redirect: (method: string, url: URL) => Promise<string>;
}

const OAUTH_LOCATION = "https://login.example.test/authorize";

async function createTestServer(
  delayMs: number,
  respond: (response: ServerResponse) => void = (response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  }
) {
  const server = createServer((_request, response) => {
    setTimeout(() => respond(response), delayMs);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected local HTTP server address");
  }
  return {
    endpoint: `http://127.0.0.1:${address.port}/v1`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

const redirectingServer = (delayMs: number) =>
  createTestServer(delayMs, (response) => {
    response.writeHead(302, { location: OAUTH_LOCATION });
    response.end();
  });

async function loadAdminClient(endpoint: string, timeoutMs: string) {
  vi.stubEnv("APPWRITE_API_KEY", "test-api-key");
  vi.stubEnv("APPWRITE_PROJECT_ID", "test-project");
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", endpoint);
  vi.stubEnv("APPWRITE_REQUEST_TIMEOUT_MS", timeoutMs);
  vi.resetModules();
  const { createAdminClient } = await import("./server");
  const admin = await createAdminClient();
  return (admin.account as unknown as { client: TestClient }).client;
}

afterEach(() => {
  vi.unstubAllEnvs();
  startSpan.mockClear();
  isEnabled.mockReset();
  isEnabled.mockReturnValue(true);
});

describe("Appwrite call spans with Sentry enabled", () => {
  test("a call runs in one http.client span named METHOD /path without the query", async () => {
    const server = await createTestServer(0);
    try {
      const client = await loadAdminClient(server.endpoint, "2000");
      const result = await client.call(
        "get",
        new URL(`${server.endpoint}/databases?secret=1`)
      );

      expect(result).toEqual({ ok: true });
      expect(startSpan).toHaveBeenCalledTimes(1);
      expect(startSpan.mock.calls[0]?.[0]).toEqual({
        attributes: {
          "appwrite.client": "admin",
          "http.request.method": "GET",
        },
        name: "GET /databases",
        op: "http.client",
      });
    } finally {
      await server.close();
    }
  });

  test("the span name templates row ids so calls group", async () => {
    const server = await createTestServer(0);
    try {
      const client = await loadAdminClient(server.endpoint, "2000");
      await client.call(
        "GET",
        new URL(`${server.endpoint}/tablesdb/app/tables/events/rows/r1?x=1`)
      );

      expect(startSpan.mock.calls[0]?.[0]).toMatchObject({
        name: "GET /tablesdb/app/tables/events/rows/{id}",
      });
    } finally {
      await server.close();
    }
  });

  test("the timeout conversion propagates unchanged through the span", async () => {
    const server = await createTestServer(100);
    try {
      const client = await loadAdminClient(server.endpoint, "20");

      await expect(
        client.call("GET", new URL(`${server.endpoint}/ping`))
      ).rejects.toMatchObject({ code: 504, type: "appwrite_timeout" });
      expect(startSpan).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });

  test("redirect runs in a span and passes the location through", async () => {
    const server = await redirectingServer(0);
    try {
      const client = await loadAdminClient(server.endpoint, "2000");

      await expect(
        client.redirect(
          "GET",
          new URL(`${server.endpoint}/account/tokens/oauth2/google?success=x`)
        )
      ).resolves.toBe(OAUTH_LOCATION);
      expect(startSpan).toHaveBeenCalledTimes(1);
      expect(startSpan.mock.calls[0]?.[0]).toMatchObject({
        name: "GET /account/tokens/oauth2/google",
        op: "http.client",
      });
    } finally {
      await server.close();
    }
  });

  test("redirect turns a stalled upstream into the 504 Appwrite error", async () => {
    const server = await redirectingServer(100);
    try {
      const client = await loadAdminClient(server.endpoint, "20");

      await expect(
        client.redirect("GET", new URL(`${server.endpoint}/account/tokens/x`))
      ).rejects.toMatchObject({ code: 504, type: "appwrite_timeout" });
      expect(startSpan).toHaveBeenCalledTimes(1);
    } finally {
      await server.close();
    }
  });
});

describe("Appwrite calls with Sentry disabled", () => {
  test("a call never starts a span and passes the result through", async () => {
    isEnabled.mockReturnValue(false);
    const server = await createTestServer(0);
    try {
      const client = await loadAdminClient(server.endpoint, "2000");

      await expect(
        client.call("GET", new URL(`${server.endpoint}/databases`))
      ).resolves.toEqual({ ok: true });
      expect(startSpan).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  test("a call still converts a stall into the 504 Appwrite error", async () => {
    isEnabled.mockReturnValue(false);
    const server = await createTestServer(100);
    try {
      const client = await loadAdminClient(server.endpoint, "20");

      await expect(
        client.call("GET", new URL(`${server.endpoint}/ping`))
      ).rejects.toMatchObject({
        code: 504,
        message: "Appwrite request timed out after 20ms (admin GET /ping)",
        type: "appwrite_timeout",
      });
      expect(startSpan).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  test("redirect passes the location through without a span", async () => {
    isEnabled.mockReturnValue(false);
    const server = await redirectingServer(0);
    try {
      const client = await loadAdminClient(server.endpoint, "2000");

      await expect(
        client.redirect(
          "GET",
          new URL(`${server.endpoint}/account/tokens/oauth2/google`)
        )
      ).resolves.toBe(OAUTH_LOCATION);
      expect(startSpan).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  test("redirect still converts a stall into the 504 Appwrite error", async () => {
    isEnabled.mockReturnValue(false);
    const server = await redirectingServer(100);
    try {
      const client = await loadAdminClient(server.endpoint, "20");

      await expect(
        client.redirect("GET", new URL(`${server.endpoint}/account/tokens/x`))
      ).rejects.toMatchObject({ code: 504, type: "appwrite_timeout" });
      expect(startSpan).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
