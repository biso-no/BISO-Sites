import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPassForRequest = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn(() => null));
const readGoogleWalletConfig = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPassForRequest }));
vi.mock("@repo/shared/member-pass/wallet-config", () => ({
  readAppleWalletConfig,
  readGoogleWalletConfig,
}));

import { GET, OPTIONS } from "./route";

const CODE_RE = /^v1\.user-1\.\d+\./;
const HEX_COLOR_RE = /^#/;

const HOLDER = {
  expiryDate: "2026-12-31",
  membershipName: "Semester",
  name: "Markus Heien",
  startDate: "2026-07-01",
  term: { duration: "semester", fromYear: 2026, season: "fall", toYear: 2026 },
};

function request(headers: Record<string, string> = {}) {
  return new Request("https://api.biso.no/api/member-pass", {
    headers: { authorization: "Bearer jwt", ...headers },
  }) as never;
}

describe("GET /api/member-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
  });

  it("rejects a caller with no valid session, with CORS headers still applied", async () => {
    resolveMemberPassForRequest.mockResolvedValue({
      state: "unauthenticated",
    });
    const response = await GET(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "not_authenticated" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });

  it("gives non-members a state and no codes", async () => {
    resolveMemberPassForRequest.mockResolvedValue({ state: "not_member" });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "not_member" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("gives members twenty codes, the day color and wallet flags", async () => {
    resolveMemberPassForRequest.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET(request({ origin: "https://web.biso.no" }));
    const body = await response.json();
    expect(body.state).toBe("active");
    expect(body.holder).toEqual(HOLDER);
    expect(body.codes).toHaveLength(20);
    expect(body.codes[0].code).toMatch(CODE_RE);
    expect(body.dayColor.hex).toMatch(HEX_COLOR_RE);
    expect(body.wallets).toEqual({ apple: false, google: true });
    expect(typeof body.serverNow).toBe("number");
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });

  it("reports unavailable when the secret is missing", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    resolveMemberPassForRequest.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET(request());
    expect(await response.json()).toEqual({ state: "unavailable" });
  });
});

describe("OPTIONS /api/member-pass", () => {
  it("answers CORS preflight", () => {
    const response = OPTIONS(request({ origin: "https://web.biso.no" }));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://web.biso.no"
    );
  });
});
