import { createServer } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";

const startSpan = vi.fn(
  (_options: unknown, callback: (span: unknown) => unknown) =>
    callback({ setAttribute: vi.fn() })
);

vi.mock("@sentry/core", () => ({ startSpan }));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

interface CallableClient {
  call: (method: string, url: URL) => Promise<unknown>;
}

async function createTestServer(delayMs: number) {
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    }, delayMs);
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

async function loadAdminClient(endpoint: string, timeoutMs: string) {
  vi.stubEnv("APPWRITE_API_KEY", "test-api-key");
  vi.stubEnv("APPWRITE_PROJECT_ID", "test-project");
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", endpoint);
  vi.stubEnv("APPWRITE_REQUEST_TIMEOUT_MS", timeoutMs);
  vi.resetModules();
  const { createAdminClient } = await import("./server");
  const admin = await createAdminClient();
  return (admin.account as unknown as { client: CallableClient }).client;
}

describe("Appwrite call spans", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    startSpan.mockClear();
  });

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
});
