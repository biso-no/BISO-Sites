import { beforeEach, describe, expect, it, vi } from "vitest";

const syncBiStudentIdentity = vi.hoisted(() => vi.fn());

vi.mock("@/lib/actions/bi-identity", () => ({ syncBiStudentIdentity }));

import { GET } from "./route";

function linkReturn(returnTo: string) {
  return new Request(
    `https://biso.no/api/auth/bi-link?returnTo=${encodeURIComponent(returnTo)}`
  );
}

describe("BI link return leg", () => {
  beforeEach(() => {
    syncBiStudentIdentity.mockReset();
  });

  it("marks a completed link on the page that started it", async () => {
    syncBiStudentIdentity.mockResolvedValue({
      campusHint: null,
      hasEmployeeId: true,
      studentId: "s1715738",
      success: true,
    });

    const response = await GET(linkReturn("/membership/join"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/membership/join?linked=1"
    );
  });

  it("reports a refused link instead of marking it linked", async () => {
    syncBiStudentIdentity.mockResolvedValue({
      error: "already_linked",
      success: false,
    });

    const response = await GET(linkReturn("/membership/link"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/membership/link?link_error=already_linked"
    );
  });

  it("still returns a directory failure as linked, for the page's retry state", async () => {
    syncBiStudentIdentity.mockResolvedValue({
      error: "directory_unavailable",
      success: false,
    });

    const response = await GET(linkReturn("/onboarding"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/onboarding?linked=1"
    );
  });

  it.each([
    "not_authenticated",
    "no_bi_identity",
    "invalid_bi_email",
    "sync_failed",
  ])("reports %s instead of marking it linked", async (error) => {
    syncBiStudentIdentity.mockResolvedValue({ error, success: false });

    const response = await GET(linkReturn("/onboarding"));

    expect(response.headers.get("location")).toBe(
      `https://biso.no/onboarding?link_error=${error}`
    );
  });

  it("sends an unknown return path to the profile", async () => {
    syncBiStudentIdentity.mockResolvedValue({
      campusHint: null,
      hasEmployeeId: true,
      studentId: "s1715738",
      success: true,
    });

    const response = await GET(linkReturn("https://evil.example"));

    expect(response.headers.get("location")).toBe(
      "https://biso.no/profile?linked=1"
    );
  });
});
