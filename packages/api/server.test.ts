import { createServer } from "node:http";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

interface AppwriteService {
  client: {
    call: (
      method: string,
      url: URL,
      headers?: Record<string, string>,
      params?: Record<string, unknown>
    ) => Promise<unknown>;
    prepareRequest: (
      method: string,
      url: URL,
      headers?: Record<string, string>,
      params?: Record<string, unknown>
    ) => {
      options: {
        agent?: unknown;
        dispatcher?: unknown;
        signal?: AbortSignal;
      };
    };
  };
}

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

const TEST_PROJECT_ID = "test-project";
const TEST_API_KEY = "test-api-key";

function loadServerModule(endpoint: string, timeoutMs = "50") {
  vi.stubEnv("APPWRITE_API_KEY", TEST_API_KEY);
  vi.stubEnv("APPWRITE_PROJECT_ID", TEST_PROJECT_ID);
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", endpoint);
  vi.stubEnv("APPWRITE_REQUEST_TIMEOUT_MS", timeoutMs);
  vi.resetModules();

  return import("./server");
}

async function createSlowServer(delayMs: number) {
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
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
}

async function createStatusServer(status: number) {
  const server = createServer((_request, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(
      JSON.stringify({ code: status, message: `status ${status}`, type: "x" })
    );
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

describe("createSessionJwt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("returns null when Appwrite answers 401 (no session)", async () => {
    const server = await createStatusServer(401);
    try {
      const { createSessionJwt } = await loadServerModule(server.endpoint);
      await expect(createSessionJwt()).resolves.toBeNull();
    } finally {
      await server.close();
    }
  });

  test("throws when Appwrite fails for any other reason", async () => {
    const server = await createStatusServer(503);
    try {
      const { createSessionJwt } = await loadServerModule(server.endpoint);
      await expect(createSessionJwt()).rejects.toMatchObject({ code: 503 });
    } finally {
      await server.close();
    }
  });
});

describe("server Appwrite clients", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("reuse the same transport while giving each request its own deadline signal", async () => {
    const endpoint = "https://appwrite.example.test/v1";
    const { createAdminClient } = await loadServerModule(endpoint);
    const first = await createAdminClient();
    const second = await createAdminClient();

    const firstRequest = (
      first.account as AppwriteService
    ).client.prepareRequest("GET", new URL(`${endpoint}/health`));
    const secondRequest = (
      second.account as AppwriteService
    ).client.prepareRequest("GET", new URL(`${endpoint}/health`));

    expect(firstRequest.options.agent).toBe(secondRequest.options.agent);
    expect(firstRequest.options.dispatcher).toBe(
      secondRequest.options.dispatcher
    );
    expect(firstRequest.options.signal).toBeInstanceOf(AbortSignal);
    expect(secondRequest.options.signal).toBeInstanceOf(AbortSignal);
    expect(firstRequest.options.signal).not.toBe(secondRequest.options.signal);
  });

  test("fail Appwrite calls with a timeout error when the upstream stalls", async () => {
    const slowServer = await createSlowServer(100);

    try {
      const { createAdminClient } = await loadServerModule(
        slowServer.endpoint,
        "20"
      );
      const admin = await createAdminClient();
      const client = (admin.account as AppwriteService).client;

      await expect(
        client.call("GET", new URL(`${slowServer.endpoint}/ping`))
      ).rejects.toMatchObject({
        code: 504,
        message: "Appwrite request timed out after 20ms (admin GET /ping)",
        type: "appwrite_timeout",
      });
    } finally {
      await slowServer.close();
    }
  });
});
