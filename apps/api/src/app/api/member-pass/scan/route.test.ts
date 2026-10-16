import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScanner = vi.hoisted(() => vi.fn());
const verifyScan = vi.hoisted(() => vi.fn());
const scanLog = vi.hoisted(() => ({
  latestSince: vi.fn(),
  record: vi.fn(),
}));
const scanLogFor = vi.hoisted(() => vi.fn(() => scanLog));
const getScanMembershipStatus = vi.hoisted(() => vi.fn());
const createAdminClient = vi.hoisted(() => vi.fn(async () => ({ db: {} })));

vi.mock("@/lib/member-pass/scanner-auth", () => ({ requireScanner }));
vi.mock("@repo/shared/member-pass/verify-scan", () => ({
  scanLogFor,
  verifyScan,
}));
vi.mock("@/lib/member-pass/scan-membership", () => ({
  getScanMembershipStatus,
}));
vi.mock("@repo/api/server", () => ({ createAdminClient }));

import { OPTIONS, POST } from "./route";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

function grantFor(userId: string) {
  return {
    $createdAt: "2026-09-01T00:00:00.000Z",
    $id: `grant-${userId}`,
    campus_id: "campus-1",
    email: "scanner@biso.no",
    expires_at: null,
    granted_by: "admin-1",
    invited_at: null,
    name: "Scanner",
    revoked_at: null,
    user_id: userId,
  };
}

function request(
  body: unknown,
  headers: Record<string, string> = {},
  rawBody?: string
) {
  return new Request("https://api.biso.no/api/member-pass/scan", {
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    headers: {
      authorization: "Bearer jwt",
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  }) as never;
}

let userCounter = 0;

describe("POST /api/member-pass/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMBER_PASS_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    userCounter += 1;
    requireScanner.mockResolvedValue({
      grant: grantFor(`user-${userCounter}`),
      ok: true,
      userId: `user-${userCounter}`,
    });
    verifyScan.mockResolvedValue({ result: "valid" });
  });

  it("reports not_configured when the secret is missing", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");

    const response = await POST(request({ code: "v1.user-1.1.sig" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "not_configured" });
    expect(requireScanner).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    requireScanner.mockResolvedValue({
      error: "not_authenticated",
      ok: false,
      status: 401,
    });

    const response = await POST(request({ code: "v1.user-1.1.sig" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(verifyScan).not.toHaveBeenCalled();
  });

  it("rejects a caller without an active grant (expired or revoked)", async () => {
    requireScanner.mockResolvedValue({
      error: "not_scanner",
      ok: false,
      status: 403,
    });

    const response = await POST(request({ code: "v1.user-1.1.sig" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_scanner" });
    expect(verifyScan).not.toHaveBeenCalled();
  });

  it("rejects an invalid JSON body", async () => {
    const response = await POST(request(undefined, {}, "not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("rejects a missing code field", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("rejects a non-string code", async () => {
    const response = await POST(request({ code: 12_345 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("rejects an empty (or whitespace-only) code", async () => {
    const response = await POST(request({ code: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("rejects a code over 256 characters", async () => {
    const response = await POST(request({ code: "a".repeat(257) }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_body" });
  });

  it("accepts a code exactly 256 characters", async () => {
    const response = await POST(request({ code: "a".repeat(256) }));

    expect(response.status).toBe(200);
  });

  it("trims the code before verifying", async () => {
    await POST(request({ code: "  v1.user-1.1.sig  " }));

    expect(verifyScan).toHaveBeenCalledWith(
      "v1.user-1.1.sig",
      expect.anything(),
      expect.anything()
    );
  });

  it("verifies with the scanner's own user id and returns the outcome as-is", async () => {
    const userId = `user-${userCounter}`;
    verifyScan.mockResolvedValue({ name: "Markus", result: "valid" });

    const response = await POST(request({ code: "v1.user-1.1.sig" }));

    expect(await response.json()).toEqual({ name: "Markus", result: "valid" });
    expect(verifyScan).toHaveBeenCalledWith(
      "v1.user-1.1.sig",
      { kind: "staff", userId },
      expect.objectContaining({
        getStatus: getScanMembershipStatus,
        scans: scanLog,
        secret: SECRET,
      })
    );
  });

  it("rate-limits after 60 scans in a minute for the same caller", async () => {
    const userId = `user-${userCounter}`;
    for (let i = 0; i < 60; i += 1) {
      requireScanner.mockResolvedValue({
        grant: grantFor(userId),
        ok: true,
        userId,
      });
      const response = await POST(request({ code: `code-${i}` }));
      expect(response.status).toBe(200);
    }

    const limited = await POST(request({ code: "code-over-limit" }));

    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "rate_limited" });
  });

  it("returns a clean 500 with CORS headers when requireScanner itself throws (e.g. an Appwrite outage)", async () => {
    requireScanner.mockRejectedValue(new Error("appwrite down"));

    const response = await POST(
      request({ code: "v1.user-1.1.sig" }, { origin: "https://biso.no" })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
    expect(verifyScan).not.toHaveBeenCalled();
  });

  it("returns a clean 500 on an unexpected failure, without logging the code", async () => {
    verifyScan.mockRejectedValue(new Error("db exploded"));
    const consoleError = vi.spyOn(console, "error");

    const response = await POST(request({ code: "v1.user-1.1.sig" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
    const logged = consoleError.mock.calls
      .map((call) => call.map(String).join(" "))
      .join(" ");
    expect(logged).not.toContain("v1.user-1.1.sig");
  });
});

describe("OPTIONS /api/member-pass/scan", () => {
  it("answers CORS preflight", () => {
    const response = OPTIONS(request(undefined, { origin: "https://biso.no" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://biso.no"
    );
  });
});
