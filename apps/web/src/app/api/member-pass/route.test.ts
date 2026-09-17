import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn(() => null));
const readGoogleWalletConfig = vi.hoisted(() => vi.fn(() => ({})));

vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({
  readAppleWalletConfig,
  readGoogleWalletConfig,
}));

import { GET } from "./route";

const CODE_RE = /^v1\.user-1\.\d+\./;
const HEX_COLOR_RE = /^#/;

const HOLDER = {
  expiryDate: "2026-12-31",
  membershipName: "Semester",
  name: "Markus Heien",
  startDate: "2026-07-01",
  term: { duration: "semester", fromYear: 2026, season: "fall", toYear: 2026 },
};

describe("GET /api/member-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
  });

  it("rejects anonymous visitors", async () => {
    resolveMemberPass.mockResolvedValue({ state: "unauthenticated" });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("gives non-members a state and no codes", async () => {
    resolveMemberPass.mockResolvedValue({ state: "not_member" });
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "not_member" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("gives members twenty codes, the day color and wallet flags", async () => {
    resolveMemberPass.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    const body = await response.json();
    expect(body.state).toBe("active");
    expect(body.holder).toEqual(HOLDER);
    expect(body.codes).toHaveLength(20);
    expect(body.codes[0].code).toMatch(CODE_RE);
    expect(body.dayColor.hex).toMatch(HEX_COLOR_RE);
    expect(body.wallets).toEqual({ apple: false, google: true });
    expect(typeof body.serverNow).toBe("number");
  });

  it("reports unavailable when the secret is missing", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    resolveMemberPass.mockResolvedValue({
      holder: HOLDER,
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    expect(await response.json()).toEqual({ state: "unavailable" });
  });
});
