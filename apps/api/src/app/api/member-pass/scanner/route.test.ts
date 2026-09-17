import { beforeEach, describe, expect, it, vi } from "vitest";

const requireScanner = vi.hoisted(() => vi.fn());

vi.mock("@/lib/member-pass/scanner-auth", () => ({ requireScanner }));

import { GET, OPTIONS } from "./route";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const HEX_COLOR_RE = /^#/;
const GRANT = {
  $createdAt: "2026-09-01T00:00:00.000Z",
  $id: "grant-1",
  campus_id: "campus-1",
  email: "scanner@biso.no",
  expires_at: "2026-12-31T00:00:00.000Z",
  granted_by: "admin-1",
  invited_at: null,
  name: "Scanner",
  revoked_at: null,
  user_id: "user-1",
};

function request(headers: Record<string, string> = {}) {
  return new Request("https://api.biso.no/api/member-pass/scanner", {
    headers: { authorization: "Bearer jwt", ...headers },
  }) as never;
}

describe("GET /api/member-pass/scanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("MEMBER_PASS_SECRET", SECRET);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    requireScanner.mockResolvedValue({
      grant: GRANT,
      ok: true,
      userId: "user-1",
    });
  });

  it("reports not_configured when the secret is missing", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");

    const response = await GET(request());

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

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
  });

  it("rejects a caller with no active grant", async () => {
    requireScanner.mockResolvedValue({
      error: "not_scanner",
      ok: false,
      status: 403,
    });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "not_scanner" });
  });

  it("returns the grant's campus and expiry plus today's pass color, with CORS applied", async () => {
    const response = await GET(request({ origin: "https://web.biso.no" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.campusId).toBe("campus-1");
    expect(body.expiresAt).toBe("2026-12-31T00:00:00.000Z");
    expect(body.dayColor.hex).toMatch(HEX_COLOR_RE);
    expect(typeof body.dayColor.name).toBe("string");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });

  it("reports a null campusId and expiresAt for an all-campus, non-expiring grant", async () => {
    requireScanner.mockResolvedValue({
      grant: { ...GRANT, campus_id: null, expires_at: null },
      ok: true,
      userId: "user-1",
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body.campusId).toBeNull();
    expect(body.expiresAt).toBeNull();
  });

  it("returns a clean 500 on an unexpected failure", async () => {
    requireScanner.mockRejectedValue(new Error("appwrite down"));

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
  });
});

describe("OPTIONS /api/member-pass/scanner", () => {
  it("answers CORS preflight", () => {
    const response = OPTIONS(request({ origin: "https://web.biso.no" }));

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });
});
