import { beforeEach, describe, expect, it, vi } from "vitest";

const TOTP_KEY_HEX_RE = /^[0-9a-f]{40}$/;

const resolveMemberPass = vi.hoisted(() => vi.fn());
const readGoogleWalletConfig = vi.hoisted(() => vi.fn());
const signGoogleSaveJwt = vi.hoisted(() =>
  vi.fn((_input: unknown) => "header.payload.sig")
);

vi.mock("server-only", () => ({}));
vi.mock("@/lib/member-pass/resolve", () => ({ resolveMemberPass }));
vi.mock("@/lib/member-pass/wallet-config", () => ({ readGoogleWalletConfig }));
vi.mock("@/lib/member-pass/google-pass", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/member-pass/google-pass")>()),
  signGoogleSaveJwt,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

import { GET } from "./route";

describe("GET /api/member-pass/google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "MEMBER_PASS_SECRET",
      "test-secret-that-is-at-least-32-characters-long"
    );
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    readGoogleWalletConfig.mockReturnValue({
      clientEmail: "e",
      issuerId: "3388",
      privateKey: "k",
    });
  });

  it("is 404 when Google Wallet is not configured", async () => {
    readGoogleWalletConfig.mockReturnValue(null);
    expect((await GET()).status).toBe(404);
  });

  it("is 403 for non-members", async () => {
    resolveMemberPass.mockResolvedValue({ state: "expired" });
    expect((await GET()).status).toBe(403);
  });

  it("redirects members to the save link", async () => {
    resolveMemberPass.mockResolvedValue({
      holder: {
        expiryDate: "2026-12-31",
        membershipName: "Semester",
        name: "M",
        startDate: "2026-07-01",
        term: null,
      },
      state: "active",
      userId: "user-1",
    });
    const response = await GET();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://pay.google.com/gp/v/save/header.payload.sig"
    );
    const input = signGoogleSaveJwt.mock.calls[0]?.[0] as {
      genericObject: {
        rotatingBarcode: {
          totpDetails: { parameters: { key: string }[] };
        };
      };
      origins: string[];
    };
    expect(input.origins).toEqual(["https://biso.no"]);
    expect(
      input.genericObject.rotatingBarcode.totpDetails.parameters[0]?.key
    ).toMatch(TOTP_KEY_HEX_RE);
  });
});
