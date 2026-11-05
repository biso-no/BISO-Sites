import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers()),
}));

// A stand-in Appwrite: answers `GET /v1/users` with [status] after [delayMs].
async function fakeAppwrite(status: number, delayMs = 0) {
  const server: Server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(
        status === 200
          ? JSON.stringify({ total: 0, users: [] })
          : JSON.stringify({
              code: status,
              message: "Appwrite is down",
              type: "general_unknown",
            })
      );
    }, delayMs);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a local HTTP server address");
  }
  return {
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
    endpoint: `http://127.0.0.1:${address.port}/v1`,
  };
}

let close: (() => Promise<void>) | undefined;

async function loadRoute(endpoint: string, apiKey = "test-api-key") {
  vi.stubEnv("APPWRITE_API_KEY", apiKey);
  vi.stubEnv("APPWRITE_PROJECT_ID", "test-project");
  vi.stubEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT", endpoint);
  vi.stubEnv("APPWRITE_REQUEST_TIMEOUT_MS", "10000");
  vi.resetModules();
  return await import("./route");
}

afterEach(async () => {
  await close?.();
  close = undefined;
  vi.unstubAllEnvs();
});

describe("GET /api/health/ready", () => {
  test("answers 200 ready with the round-trip time when Appwrite answers", async () => {
    const appwrite = await fakeAppwrite(200);
    close = appwrite.close;
    const { GET } = await loadRoute(appwrite.endpoint);

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.status).toBe("ready");
    expect(typeof body.latencyMs).toBe("number");
  });

  test("answers 503 with the error message when Appwrite fails", async () => {
    const appwrite = await fakeAppwrite(500);
    close = appwrite.close;
    const { GET } = await loadRoute(appwrite.endpoint);

    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "Appwrite is down",
      status: "error",
    });
  });

  test("answers 503 when the API key is missing", async () => {
    const appwrite = await fakeAppwrite(200);
    close = appwrite.close;
    const { GET } = await loadRoute(appwrite.endpoint, "");

    const response = await GET();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain(
      "APPWRITE_API_KEY is not configured"
    );
  });

  test("answers 503 Timeout when Appwrite takes longer than 3 seconds", async () => {
    const appwrite = await fakeAppwrite(200, 4500);
    close = appwrite.close;
    const { GET } = await loadRoute(appwrite.endpoint);

    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Timeout",
      status: "error",
    });
  }, 10_000);
});
