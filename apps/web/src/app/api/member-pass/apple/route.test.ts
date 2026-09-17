import { beforeEach, describe, expect, it, vi } from "vitest";

const APPLE_CODE_RE = /^a1\.user-1\.20261231\./;

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readAppleWalletConfig = vi.hoisted(() => vi.fn());
const buildAppleWalletPass = vi.hoisted(() =>
  vi.fn(async (_input: unknown) => Buffer.from("PKPASS"))
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({ readAppleWalletConfig }));
vi.mock("@/lib/member-pass/apple-pass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/member-pass/apple-pass")>()),
  buildAppleWalletPass,
  loadWalletIcon: vi.fn(async () => Buffer.from("PNG")),
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));

import { GET } from "./route";

const ACTIVE = {
  holder: {
    expiryDate: "2026-12-31",
    membershipName: "Semester",
    name: "Markus Heien",
    startDate: "2026-07-01",
    term: {
      duration: "semester",
      fromYear: 2026,
      season: "fall",
      toYear: 2026,
    },
  },
  state: "active",
  userId: "user-1",
};

describe("GET /api/member-pass/apple", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
    readAppleWalletConfig.mockReturnValue({
      passTypeId: "p",
      signerCert: "c",
      signerKey: "k",
      teamId: "t",
      wwdr: "w",
    });
  });

  it("is 404 when Apple Wallet is not configured", async () => {
    readAppleWalletConfig.mockReturnValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("is 404 when MEMBER_PASS_SECRET is not configured", async () => {
    vi.stubEnv("MEMBER_PASS_SECRET", "");
    expect((await GET()).status).toBe(404);
  });

  it("is 401 for anonymous visitors and 403 for non-members", async () => {
    resolveMemberPass.mockResolvedValue({ state: "unauthenticated" });
    expect((await GET()).status).toBe(401);
    resolveMemberPass.mockResolvedValue({ state: "not_member" });
    expect((await GET()).status).toBe(403);
  });

  it("returns a signed pass for members", async () => {
    resolveMemberPass.mockResolvedValue(ACTIVE);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "application/vnd.apple.pkpass"
    );
    expect(response.headers.get("content-disposition")).toContain(
      "biso-membership.pkpass"
    );
    const input = buildAppleWalletPass.mock.calls[0]?.[0] as {
      code: string;
      expiryDate: string;
    };
    expect(input.code).toMatch(APPLE_CODE_RE);
    expect(input.expiryDate).toBe("2026-12-31");
  });
});
